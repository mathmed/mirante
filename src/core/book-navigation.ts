import { PAGE_ASPECT, type Rect } from './book-geometry.ts'
import {
  type Book,
  type BookLayouts,
  type BookPage,
  PageKind,
  type PhotoPage,
  type Spread,
} from './book.ts'
import { firstOr } from './lists.ts'
import {
  currentSlide,
  type PresentationState,
  type Slide,
  slidesAhead,
  type Upcoming,
} from './presentation.ts'
import { RemoteKey } from './remote-key.ts'

// The remote control in a book. The focus is on a photo of the spread, on a button of the bar under
// it, or on a spread of the strip under the bar. On the photos, the arrows go to the nearest photo
// that way; past the edge of the spread, left and right turn the page, and down reaches the bar.
// Enter opens the photo, presses the button or opens the spread of the strip. Back leaves the bar
// and the strip for the photos, and the photos for the screen below.

export const BookZone = {
  Page: 'page',
  Controls: 'controls',
  Strip: 'strip',
} as const

export const BookControl = {
  Previous: 'previous',
  Play: 'play',
  Overview: 'overview',
  Reorganize: 'reorganize',
  Next: 'next',
} as const

export type BookControl = (typeof BookControl)[keyof typeof BookControl]

// The buttons of the bar, left to right: the overview in the middle, the arrows at the sides.
export const BOOK_CONTROLS: readonly BookControl[] = [
  BookControl.Previous,
  BookControl.Play,
  BookControl.Overview,
  BookControl.Reorganize,
  BookControl.Next,
]

export const OVERVIEW_CONTROL = BOOK_CONTROLS.indexOf(BookControl.Overview)
// The spread on the screen, and the one leaving it or coming next.
const KEPT_SPREADS = 2
const HALF = 0.5

// A photo by its place in the spread, left page first; past the last one means the last one.
export const LAST_FRAME = Number.MAX_SAFE_INTEGER

export type BookFocus =
  | { readonly zone: typeof BookZone.Controls; readonly control: number }
  | { readonly zone: typeof BookZone.Page; readonly frame: number }
  | { readonly zone: typeof BookZone.Strip; readonly spread: number }

const FIRST_PHOTO: BookFocus = { zone: BookZone.Page, frame: 0 }

export const BookActionKind = {
  Focus: 'focus',
  Turn: 'turn',
  Open: 'open',
  Press: 'press',
  Jump: 'jump',
  Leave: 'leave',
} as const

export type BookAction =
  | { readonly kind: typeof BookActionKind.Focus; readonly focus: BookFocus }
  | { readonly kind: typeof BookActionKind.Jump; readonly spread: number }
  | { readonly kind: typeof BookActionKind.Leave }
  | { readonly kind: typeof BookActionKind.Open; readonly frame: number }
  | { readonly kind: typeof BookActionKind.Press; readonly control: BookControl }
  | {
      readonly kind: typeof BookActionKind.Turn
      readonly key: RemoteKey
      readonly focus: BookFocus
    }

// The spread on the screen: its photos, in page heights across the two pages, and where it is.
export interface BookPlace {
  readonly frames: readonly Rect[]
  readonly spread: number
  readonly spreadCount: number
}

// A key pressed on the photo, the button or the spread of the strip at this place.
type Press = (pressing: { readonly at: number; readonly place: BookPlace }) => BookAction

const ON_PHOTOS: ReadonlyMap<RemoteKey, Press> = new Map<RemoteKey, Press>([
  [RemoteKey.Enter, ({ at }) => ({ kind: BookActionKind.Open, frame: at })],
  [RemoteKey.Back, () => ({ kind: BookActionKind.Leave })],
  [RemoteKey.Left, (pressing) => moveOnPhotos(RemoteKey.Left, pressing)],
  [RemoteKey.Right, (pressing) => moveOnPhotos(RemoteKey.Right, pressing)],
  [RemoteKey.Up, (pressing) => moveOnPhotos(RemoteKey.Up, pressing)],
  [RemoteKey.Down, (pressing) => moveOnPhotos(RemoteKey.Down, pressing)],
])

// Past the edge of the spread: the page before or after, or the bar.
const PAST_THE_EDGE: ReadonlyMap<RemoteKey, Press> = new Map<RemoteKey, Press>([
  [RemoteKey.Down, () => focusOn({ zone: BookZone.Controls, control: OVERVIEW_CONTROL })],
  [
    RemoteKey.Left,
    ({ at, place }) =>
      place.spread > 0 ? turn(RemoteKey.Left, LAST_FRAME) : focusOn(photoFocus(at)),
  ],
  [
    RemoteKey.Right,
    ({ at, place }) =>
      place.spread + 1 < place.spreadCount ? turn(RemoteKey.Right, 0) : focusOn(photoFocus(at)),
  ],
])

const ON_CONTROLS: ReadonlyMap<RemoteKey, Press> = new Map<RemoteKey, Press>([
  [RemoteKey.Left, ({ at }) => focusOn(controlFocus(Math.max(0, at - 1)))],
  [RemoteKey.Right, ({ at }) => focusOn(controlFocus(Math.min(BOOK_CONTROLS.length - 1, at + 1)))],
  [RemoteKey.Up, () => focusOn(FIRST_PHOTO)],
  [RemoteKey.Back, () => focusOn(FIRST_PHOTO)],
  [RemoteKey.Down, ({ place }) => focusOn(stripFocus(place.spread))],
  [
    RemoteKey.Enter,
    ({ at }) => ({
      kind: BookActionKind.Press,
      control: firstOr(BOOK_CONTROLS.slice(at, at + 1), BookControl.Overview),
    }),
  ],
])

const ON_STRIP: ReadonlyMap<RemoteKey, Press> = new Map<RemoteKey, Press>([
  [RemoteKey.Left, ({ at }) => focusOn(stripFocus(Math.max(0, at - 1)))],
  [
    RemoteKey.Right,
    ({ at, place }) => focusOn(stripFocus(Math.min(place.spreadCount - 1, at + 1))),
  ],
  [RemoteKey.Up, () => focusOn(controlFocus(OVERVIEW_CONTROL))],
  [RemoteKey.Back, () => focusOn(FIRST_PHOTO)],
  [RemoteKey.Enter, ({ at }) => ({ kind: BookActionKind.Jump, spread: at })],
])

// A key that does nothing there leaves the focus where it is.
export function pressInBook(focus: BookFocus, key: RemoteKey, place: BookPlace): BookAction {
  const at = placeOf(focus, place)
  return pressesOf(focus).get(key)?.({ at, place }) ?? focusOn(withPlace(focus, at))
}

// The photos of a spread, left page then right page, as the remote control moves among them: in
// page heights, the right page beside the left one.
export function spreadRects(spread: Spread, layouts: BookLayouts): readonly Rect[] {
  const pages = [spread.left, spread.right]
  return ([] as Rect[]).concat(
    ...pages.map((page, side) =>
      page === undefined || page.kind === PageKind.Cover
        ? []
        : layouts.layoutOf(page).frames.map(({ photo }) => inSpread(photo, side)),
    ),
  )
}

// The spreads kept decoded: the one on the screen and, while a page turns, the one leaving it, or
// else the next one, ready. Never more than two.
export function spreadsKept(
  book: Book,
  presentation: { readonly state: PresentationState; readonly upcoming: Upcoming },
): readonly Spread[] {
  const { state, upcoming } = presentation
  const keys = [currentSlide(state), state.leaving, slidesAhead(state, upcoming)[0]]
    .filter((slide): slide is Slide => slide !== undefined)
    .map(({ key }) => key)
  return [...new Set(keys)]
    .slice(0, KEPT_SPREADS)
    .map((key) => book.spreads.find((spread) => spread.key === key))
    .filter((spread): spread is Spread => spread !== undefined)
}

// The pages of photos of these spreads, the cover left out.
export function photoPagesOf(spreads: readonly Spread[]): readonly PhotoPage[] {
  const pages = ([] as (BookPage | undefined)[]).concat(
    ...spreads.map((spread) => [spread.left, spread.right]),
  )
  return pages.filter((page): page is PhotoPage => page?.kind === PageKind.Photos)
}

// The first of the spreads the strip shows, with the one in focus in their middle.
export function stripStart(spread: number, spreadCount: number, shown: number): number {
  const centered = spread - Math.floor(shown * HALF)
  return Math.max(0, Math.min(centered, spreadCount - shown))
}

function inSpread(photo: Rect, side: number): Rect {
  return {
    x: (side + photo.x) * PAGE_ASPECT,
    y: photo.y,
    width: photo.width * PAGE_ASPECT,
    height: photo.height,
  }
}

function pressesOf(focus: BookFocus): ReadonlyMap<RemoteKey, Press> {
  switch (focus.zone) {
    case BookZone.Page:
      return ON_PHOTOS
    case BookZone.Controls:
      return ON_CONTROLS
    default:
      return ON_STRIP
  }
}

// The photo in focus, the button or the spread of the strip; a photo past the last is the last.
function placeOf(focus: BookFocus, place: BookPlace): number {
  switch (focus.zone) {
    case BookZone.Page:
      return Math.min(focus.frame, place.frames.length - 1)
    case BookZone.Controls:
      return focus.control
    default:
      return focus.spread
  }
}

function withPlace(focus: BookFocus, at: number): BookFocus {
  return focus.zone === BookZone.Page ? photoFocus(at) : focus
}

function moveOnPhotos(
  key: RemoteKey,
  pressing: { readonly at: number; readonly place: BookPlace },
): BookAction {
  const next = nearestFrame(pressing.place.frames, pressing.at, key)
  if (next !== undefined) {
    return focusOn(photoFocus(next))
  }
  return PAST_THE_EDGE.get(key)?.(pressing) ?? focusOn(photoFocus(pressing.at))
}

function turn(key: RemoteKey, frame: number): BookAction {
  return { kind: BookActionKind.Turn, key, focus: photoFocus(frame) }
}

function focusOn(focus: BookFocus): BookAction {
  return { kind: BookActionKind.Focus, focus }
}

function photoFocus(frame: number): BookFocus {
  return { zone: BookZone.Page, frame }
}

function controlFocus(control: number): BookFocus {
  return { zone: BookZone.Controls, control }
}

function stripFocus(spread: number): BookFocus {
  return { zone: BookZone.Strip, spread }
}

// How far ahead a box is that way (negative when it is not ahead at all), and how far off to the
// side of the way.
interface Way {
  readonly ahead: (from: Rect, to: Rect) => number
  readonly aside: (from: Rect, to: Rect) => number
}

const WAYS: ReadonlyMap<RemoteKey, Way> = new Map([
  [RemoteKey.Right, { ahead: (from: Rect, to: Rect) => to.x - right(from), aside: offDown }],
  [RemoteKey.Left, { ahead: (from: Rect, to: Rect) => from.x - right(to), aside: offDown }],
  [RemoteKey.Down, { ahead: (from: Rect, to: Rect) => to.y - bottom(from), aside: offAcross }],
  [RemoteKey.Up, { ahead: (from: Rect, to: Rect) => from.y - bottom(to), aside: offAcross }],
])

// Being off to the side counts more than being further ahead: the photo in line comes first.
const ASIDE_WEIGHT = 2
// Photos never overlap: one that starts where this one ends is ahead.
const TOUCHING = -1e-9

// The photo the arrow reaches: the nearest one that way; none at the edge of the spread.
export function nearestFrame(
  frames: readonly Rect[],
  frame: number,
  key: RemoteKey,
): number | undefined {
  const [from] = frames.slice(frame, frame + 1)
  const way = WAYS.get(key)
  if (from === undefined || way === undefined) {
    return undefined
  }
  const ahead = frames
    .map((to, index) => ({ index, distance: way.ahead(from, to), offset: way.aside(from, to) }))
    .filter(({ distance }) => distance >= TOUCHING)
  ahead.sort(
    (first, second) =>
      first.distance +
      ASIDE_WEIGHT * first.offset -
      (second.distance + ASIDE_WEIGHT * second.offset),
  )
  return ahead[0]?.index
}

interface Span {
  readonly start: number
  readonly end: number
}

// How far apart two spans are: 0 when they overlap.
function apart(one: Span, other: Span): number {
  return Math.max(0, other.start - one.end, one.start - other.end)
}

function offDown(from: Rect, to: Rect): number {
  return apart({ start: from.y, end: bottom(from) }, { start: to.y, end: bottom(to) })
}

function offAcross(from: Rect, to: Rect): number {
  return apart({ start: from.x, end: right(from) }, { start: to.x, end: right(to) })
}

function right(rect: Rect): number {
  return rect.x + rect.width
}

function bottom(rect: Rect): number {
  return rect.y + rect.height
}
