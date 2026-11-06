import type { Rect } from './book-geometry.ts'
import { frameToward } from './book-moves.ts'
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

// The remote control in a book, which fills the screen. The focus is on a photo of the spread, or
// on the layer of the controls over the book: a button of its bar, or a spread of the strip under
// the bar. On the photos, left and right turn the page, up and down go to the photo above or below,
// and down from the last photo, or Info, shows the layer. Enter opens the photo, presses the button
// or opens the spread of the strip. Back hides the layer, and leaves the book when it is hidden.
// While the book plays, only the pages show: any arrow, Enter or Info pauses it and shows the layer.

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
export const PLAY_CONTROL = BOOK_CONTROLS.indexOf(BookControl.Play)
// The spread on the screen, and the one leaving it or coming next.
const KEPT_SPREADS = 2
const HALF = 0.5

// On the layer, the focus keeps the photo it came from, by its place in the spread: hiding the
// layer brings the focus back to it.
export type BookFocus =
  | { readonly zone: typeof BookZone.Controls; readonly control: number; readonly frame: number }
  | { readonly zone: typeof BookZone.Page; readonly frame: number }
  | { readonly zone: typeof BookZone.Strip; readonly spread: number; readonly frame: number }

export const BookActionKind = {
  Focus: 'focus',
  Turn: 'turn',
  Open: 'open',
  Press: 'press',
  Pause: 'pause',
  Jump: 'jump',
  Leave: 'leave',
} as const

export type BookAction =
  | { readonly kind: typeof BookActionKind.Focus; readonly focus: BookFocus }
  | { readonly kind: typeof BookActionKind.Jump; readonly spread: number }
  | { readonly kind: typeof BookActionKind.Leave }
  | { readonly kind: typeof BookActionKind.Open; readonly frame: number }
  | { readonly kind: typeof BookActionKind.Pause; readonly focus: BookFocus }
  | {
      readonly kind: typeof BookActionKind.Press
      readonly control: BookControl
      readonly focus: BookFocus
    }
  | {
      readonly kind: typeof BookActionKind.Turn
      readonly key: RemoteKey
      readonly focus: BookFocus
    }

// The spread on the screen: its photos, in page heights across the two pages, where it is, and
// whether the book plays.
export interface BookPlace {
  readonly frames: readonly Rect[]
  readonly spread: number
  readonly spreadCount: number
  readonly isPlaying: boolean
}

// A key pressed on the photo, the button or the spread of the strip at this place; the photo the
// focus comes back to when the layer hides.
interface Pressing {
  readonly at: number
  readonly photo: number
  readonly place: BookPlace
}

type Press = (pressing: Pressing) => BookAction

const ON_PHOTOS: ReadonlyMap<RemoteKey, Press> = new Map<RemoteKey, Press>([
  [RemoteKey.Enter, ({ at }) => ({ kind: BookActionKind.Open, frame: at })],
  [RemoteKey.Back, leave],
  [
    RemoteKey.Left,
    ({ at, place }) => (place.spread > 0 ? turn(RemoteKey.Left) : focusOn(photoFocus(at))),
  ],
  [
    RemoteKey.Right,
    ({ at, place }) =>
      place.spread + 1 < place.spreadCount ? turn(RemoteKey.Right) : focusOn(photoFocus(at)),
  ],
  [
    RemoteKey.Up,
    ({ at, place }) => focusOn(photoFocus(frameToward(place.frames, at, RemoteKey.Up) ?? at)),
  ],
  [RemoteKey.Down, down],
  [RemoteKey.Info, ({ at }) => focusOn(controlFocus(OVERVIEW_CONTROL, at))],
])

const ON_CONTROLS: ReadonlyMap<RemoteKey, Press> = new Map<RemoteKey, Press>([
  [RemoteKey.Left, ({ at, photo }) => focusOn(controlFocus(Math.max(0, at - 1), photo))],
  [
    RemoteKey.Right,
    ({ at, photo }) => focusOn(controlFocus(Math.min(BOOK_CONTROLS.length - 1, at + 1), photo)),
  ],
  [RemoteKey.Up, hideLayer],
  [RemoteKey.Back, hideLayer],
  [RemoteKey.Info, hideLayer],
  [RemoteKey.Down, ({ photo, place }) => focusOn(stripFocus(place.spread, photo))],
  [RemoteKey.Enter, pressControl],
])

const ON_STRIP: ReadonlyMap<RemoteKey, Press> = new Map<RemoteKey, Press>([
  [RemoteKey.Left, ({ at, photo }) => focusOn(stripFocus(Math.max(0, at - 1), photo))],
  [
    RemoteKey.Right,
    ({ at, photo, place }) => focusOn(stripFocus(Math.min(place.spreadCount - 1, at + 1), photo)),
  ],
  [RemoteKey.Up, ({ photo }) => focusOn(controlFocus(OVERVIEW_CONTROL, photo))],
  [RemoteKey.Back, hideLayer],
  [RemoteKey.Info, hideLayer],
  [RemoteKey.Enter, ({ at }) => ({ kind: BookActionKind.Jump, spread: at })],
])

// While the book plays: Back leaves it, and the other keys pause it on the play button.
const PAUSE_KEYS: readonly RemoteKey[] = [
  RemoteKey.Left,
  RemoteKey.Right,
  RemoteKey.Up,
  RemoteKey.Down,
  RemoteKey.Enter,
  RemoteKey.Info,
]

const WHILE_PLAYING: ReadonlyMap<RemoteKey, Press> = new Map<RemoteKey, Press>([
  [RemoteKey.Back, leave],
  ...PAUSE_KEYS.map((key): readonly [RemoteKey, Press] => [key, pause]),
])

// A key that does nothing there leaves the focus where it is.
export function pressInBook(focus: BookFocus, key: RemoteKey, place: BookPlace): BookAction {
  const at = placeOf(focus, place)
  const photo = lastAtMost(focus.frame, place)
  const presses = place.isPlaying ? WHILE_PLAYING : pressesOf(focus)
  return presses.get(key)?.({ at, photo, place }) ?? focusOn(focus)
}

// Whether the layer of the controls shows over the book: while the focus is on it.
export function isLayerShown(focus: BookFocus): boolean {
  return focus.zone !== BookZone.Page
}

// The layer hides by itself after a while: the focus goes back to its photo.
export function withoutLayer(focus: BookFocus): BookFocus {
  return focus.zone === BookZone.Page ? focus : photoFocus(focus.frame)
}

// The photos of a spread, left page then right page, as the remote control moves among them: in
// page heights, the right page beside the left one.
export function spreadRects(spread: Spread, layouts: BookLayouts): readonly Rect[] {
  const pages = [spread.left, spread.right]
  return ([] as Rect[]).concat(
    ...pages.map((page, side) =>
      page === undefined || page.kind === PageKind.Cover
        ? []
        : layouts.layoutOf(page).frames.map(({ photo }) => inSpread(photo, side, layouts)),
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

function inSpread(photo: Rect, side: number, layouts: BookLayouts): Rect {
  const aspect = layouts.pageAspect
  return {
    x: (side + photo.x) * aspect,
    y: photo.y,
    width: photo.width * aspect,
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
      return lastAtMost(focus.frame, place)
    case BookZone.Controls:
      return focus.control
    default:
      return focus.spread
  }
}

function lastAtMost(frame: number, place: BookPlace): number {
  return Math.min(frame, place.frames.length - 1)
}

// The photo below or, from the last one, the layer.
function down({ at, place }: Pressing): BookAction {
  const below = frameToward(place.frames, at, RemoteKey.Down)
  return focusOn(below === undefined ? controlFocus(OVERVIEW_CONTROL, at) : photoFocus(below))
}

function hideLayer({ photo }: Pressing): BookAction {
  return focusOn(photoFocus(photo))
}

// Playing hides the layer, and the focus goes back to the photo; the other buttons keep it.
function pressControl({ at, photo }: Pressing): BookAction {
  const control = firstOr(BOOK_CONTROLS.slice(at, at + 1), BookControl.Overview)
  return {
    kind: BookActionKind.Press,
    control,
    focus: control === BookControl.Play ? photoFocus(photo) : controlFocus(at, photo),
  }
}

function pause({ photo }: Pressing): BookAction {
  return { kind: BookActionKind.Pause, focus: controlFocus(PLAY_CONTROL, photo) }
}

function leave(): BookAction {
  return { kind: BookActionKind.Leave }
}

// A page turns to the first photo of the next spread, or of the one before.
function turn(key: RemoteKey): BookAction {
  return { kind: BookActionKind.Turn, key, focus: photoFocus(0) }
}

function focusOn(focus: BookFocus): BookAction {
  return { kind: BookActionKind.Focus, focus }
}

function photoFocus(frame: number): BookFocus {
  return { zone: BookZone.Page, frame }
}

function controlFocus(control: number, frame: number): BookFocus {
  return { zone: BookZone.Controls, control, frame }
}

function stripFocus(spread: number, frame: number): BookFocus {
  return { zone: BookZone.Strip, spread, frame }
}
