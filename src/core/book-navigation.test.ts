import { describe, expect, it } from 'vitest'

import { defined, mixedPhotos } from '../../test/book-photos.ts'
import { PAGE_ASPECT, type Rect } from './book-geometry.ts'
import {
  BOOK_CONTROLS,
  type BookAction,
  BookActionKind,
  BookControl,
  type BookFocus,
  type BookPlace,
  BookZone,
  LAST_FRAME,
  nearestFrame,
  OVERVIEW_CONTROL,
  photoPagesOf,
  pressInBook,
  spreadRects,
  spreadsKept,
  stripStart,
} from './book-navigation.ts'
import { BookDensity } from './book-pagination.ts'
import { bookLayouts, planBook } from './book.ts'
import { advancePresentation, pressInPresentation, startPresentation } from './presentation.ts'
import { RemoteKey } from './remote-key.ts'

const { Up, Down, Left, Right, Enter, Back, Info } = RemoteKey

// Two pages side by side, in page heights: on the left a large photo and two small ones under
// it; on the right two photos side by side.
//   +-------+-------+   +---+---+
//   |   0           |   | 3 | 4 |
//   +---+---+-------+   +---+---+
//   | 1 | 2 |
const FRAMES: readonly Rect[] = [
  { x: 0.1, y: 0.1, width: 1, height: 0.5 },
  { x: 0.1, y: 0.65, width: 0.45, height: 0.3 },
  { x: 0.65, y: 0.65, width: 0.45, height: 0.3 },
  { x: 1.5, y: 0.2, width: 0.5, height: 0.6 },
  { x: 2.1, y: 0.2, width: 0.5, height: 0.6 },
]

const MIDDLE: BookPlace = { frames: FRAMES, spread: 3, spreadCount: 8 }

function photo(frame: number): BookFocus {
  return { zone: BookZone.Page, frame }
}

function focusOn(focus: BookFocus): BookAction {
  return { kind: BookActionKind.Focus, focus }
}

describe('nearestFrame', () => {
  it.each([
    [0, Right, 3],
    [0, Down, 1],
    [1, Right, 2],
    [2, Right, 3],
    [2, Up, 0],
    [1, Up, 0],
    [3, Right, 4],
    [4, Left, 3],
    [3, Left, 0],
  ])('should go from photo %i, %s, to photo %i', (from, key, to) => {
    expect(nearestFrame(FRAMES, from, key)).toBe(to)
  })

  it.each([
    [0, Up],
    [0, Left],
    [1, Down],
    [1, Left],
    [4, Right],
    [3, Down],
  ])('should find no photo from photo %i, %s, at the edge of the spread', (from, key) => {
    expect(nearestFrame(FRAMES, from, key)).toBeUndefined()
  })

  it('should prefer the photo in line to a nearer one off to the side', () => {
    const frames: readonly Rect[] = [
      { x: 0, y: 0.4, width: 0.2, height: 0.2 },
      { x: 0.3, y: 0, width: 0.1, height: 0.1 },
      { x: 0.6, y: 0.45, width: 0.2, height: 0.1 },
    ]

    expect(nearestFrame(frames, 0, Right)).toBe(2)
  })

  it('should prefer the photo in line wherever it comes on the spread', () => {
    const frames: readonly Rect[] = [
      { x: 0, y: 0.4, width: 0.2, height: 0.2 },
      { x: 0.6, y: 0.45, width: 0.2, height: 0.1 },
      { x: 0.3, y: 0, width: 0.1, height: 0.1 },
    ]

    expect(nearestFrame(frames, 0, Right)).toBe(1)
  })

  it('should take a photo that overlaps this one by a rounding error as ahead', () => {
    const frames: readonly Rect[] = [
      { x: -0.5, y: 0, width: 0.5, height: 1 },
      { x: -1e-9, y: 0, width: 0.5, height: 1 },
    ]

    expect(nearestFrame(frames, 0, Right)).toBe(1)
  })

  it('should take a photo that starts where this one ends as ahead', () => {
    const frames: readonly Rect[] = [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 1 },
    ]

    expect(nearestFrame(frames, 0, Right)).toBe(1)
    expect(nearestFrame(frames, 1, Left)).toBe(0)
  })

  it('should find nothing from a photo that is not there, or for a key that does not move', () => {
    expect(nearestFrame(FRAMES, 9, Right)).toBeUndefined()
    expect(nearestFrame(FRAMES, 0, Enter)).toBeUndefined()
  })
})

describe('pressInBook', () => {
  it('should move among the photos with the arrows', () => {
    expect(pressInBook(photo(0), Down, MIDDLE)).toStrictEqual(focusOn(photo(1)))
    expect(pressInBook(photo(2), Right, MIDDLE)).toStrictEqual(focusOn(photo(3)))
  })

  it('should turn to the next page past the right edge, on its first photo', () => {
    expect(pressInBook(photo(4), Right, MIDDLE)).toStrictEqual({
      kind: BookActionKind.Turn,
      key: Right,
      focus: photo(0),
    })
  })

  it('should turn to the page before past the left edge, on its last photo', () => {
    expect(pressInBook(photo(0), Left, MIDDLE)).toStrictEqual({
      kind: BookActionKind.Turn,
      key: Left,
      focus: photo(LAST_FRAME),
    })
  })

  it('should stay on the first and on the last spread', () => {
    expect(pressInBook(photo(0), Left, { ...MIDDLE, spread: 0 })).toStrictEqual(focusOn(photo(0)))
    expect(pressInBook(photo(4), Right, { ...MIDDLE, spread: 7 })).toStrictEqual(focusOn(photo(4)))
  })

  it('should go down from the bottom of the spread to the overview button', () => {
    expect(pressInBook(photo(3), Down, MIDDLE)).toStrictEqual(
      focusOn({ zone: BookZone.Controls, control: OVERVIEW_CONTROL }),
    )
  })

  it('should stay at the top of the spread', () => {
    expect(pressInBook(photo(0), Up, MIDDLE)).toStrictEqual(focusOn(photo(0)))
  })

  it('should open the photo in focus with Enter, and leave the book with Back', () => {
    expect(pressInBook(photo(2), Enter, MIDDLE)).toStrictEqual({
      kind: BookActionKind.Open,
      frame: 2,
    })
    expect(pressInBook(photo(2), Back, MIDDLE)).toStrictEqual({ kind: BookActionKind.Leave })
  })

  it('should take a photo past the last one as the last one', () => {
    expect(pressInBook(photo(LAST_FRAME), Enter, MIDDLE)).toStrictEqual({
      kind: BookActionKind.Open,
      frame: 4,
    })
    expect(pressInBook(photo(LAST_FRAME), Info, MIDDLE)).toStrictEqual(focusOn(photo(4)))
  })

  it('should move along the buttons, and stop at their ends', () => {
    const controls = (control: number): BookFocus => ({ zone: BookZone.Controls, control })
    const last = BOOK_CONTROLS.length - 1

    expect(pressInBook(controls(1), Left, MIDDLE)).toStrictEqual(focusOn(controls(0)))
    expect(pressInBook(controls(0), Left, MIDDLE)).toStrictEqual(focusOn(controls(0)))
    expect(pressInBook(controls(1), Right, MIDDLE)).toStrictEqual(focusOn(controls(2)))
    expect(pressInBook(controls(last), Right, MIDDLE)).toStrictEqual(focusOn(controls(last)))
    expect(pressInBook(controls(2), Info, MIDDLE)).toStrictEqual(focusOn(controls(2)))
  })

  it.each(BOOK_CONTROLS.map((control, index) => [control, index] as const))(
    'should press %s with Enter',
    (control, index) => {
      expect(pressInBook({ zone: BookZone.Controls, control: index }, Enter, MIDDLE)).toStrictEqual(
        {
          kind: BookActionKind.Press,
          control,
        },
      )
    },
  )

  it('should go back up to the photos, and down to the spread on the screen in the strip', () => {
    const overview: BookFocus = { zone: BookZone.Controls, control: OVERVIEW_CONTROL }

    expect(pressInBook(overview, Up, MIDDLE)).toStrictEqual(focusOn(photo(0)))
    expect(pressInBook(overview, Back, MIDDLE)).toStrictEqual(focusOn(photo(0)))
    expect(pressInBook(overview, Down, MIDDLE)).toStrictEqual(
      focusOn({ zone: BookZone.Strip, spread: 3 }),
    )
  })

  it('should move along the strip, stopping at its ends, and open a spread with Enter', () => {
    const strip = (spread: number): BookFocus => ({ zone: BookZone.Strip, spread })

    expect(pressInBook(strip(3), Left, MIDDLE)).toStrictEqual(focusOn(strip(2)))
    expect(pressInBook(strip(0), Left, MIDDLE)).toStrictEqual(focusOn(strip(0)))
    expect(pressInBook(strip(3), Right, MIDDLE)).toStrictEqual(focusOn(strip(4)))
    expect(pressInBook(strip(7), Right, MIDDLE)).toStrictEqual(focusOn(strip(7)))
    expect(pressInBook(strip(5), Enter, MIDDLE)).toStrictEqual({
      kind: BookActionKind.Jump,
      spread: 5,
    })
    expect(pressInBook(strip(5), Down, MIDDLE)).toStrictEqual(focusOn(strip(5)))
  })

  it('should leave the strip for the overview button above it, or for the photos with Back', () => {
    const strip: BookFocus = { zone: BookZone.Strip, spread: 5 }

    expect(pressInBook(strip, Up, MIDDLE)).toStrictEqual(
      focusOn({ zone: BookZone.Controls, control: OVERVIEW_CONTROL }),
    )
    expect(pressInBook(strip, Back, MIDDLE)).toStrictEqual(focusOn(photo(0)))
  })

  it('should put the overview in the middle of the buttons, the arrows at the sides', () => {
    expect(BOOK_CONTROLS).toStrictEqual([
      BookControl.Previous,
      BookControl.Play,
      BookControl.Overview,
      BookControl.Reorganize,
      BookControl.Next,
    ])
    expect(OVERVIEW_CONTROL).toBe(2)
  })
})

describe('spreadRects', () => {
  const book = planBook(mixedPhotos(40), {
    title: 'Viagem',
    seed: 3,
    density: BookDensity.Normal,
    hasCover: true,
    weights: new Map(),
  })
  const layouts = bookLayouts(book)

  it('should place the photos of the right page after those of the left one, in page heights', () => {
    const [, , third] = book.pages
    const leftCount = defined(book.pages[1]).photos.length
    const sut = spreadRects(defined(book.spreads[1]), layouts)
    const first = defined(layouts.layoutOf(defined(third)).frames[0]).photo
    const [placed] = sut.slice(leftCount)

    expect(sut).toHaveLength(leftCount + defined(third).photos.length)
    expect(defined(placed).x).toBeCloseTo((1 + first.x) * PAGE_ASPECT, 12)
    expect(defined(placed).y).toBe(first.y)
    expect(defined(placed).width).toBeCloseTo(first.width * PAGE_ASPECT, 12)
    expect(defined(placed).height).toBe(first.height)
  })

  it('should leave out the cover, and a blank page', () => {
    const [opening] = book.spreads
    const [first] = book.pages
    const lone = planBook(mixedPhotos(1), {
      title: 'Uma',
      seed: 3,
      density: BookDensity.Normal,
      hasCover: false,
      weights: new Map(),
    })

    expect(spreadRects(defined(opening), layouts)).toHaveLength(defined(first).photos.length)
    expect(spreadRects(defined(lone.spreads[0]), bookLayouts(lone))).toHaveLength(1)
  })
})

describe('spreadsKept', () => {
  const book = planBook(mixedPhotos(40), {
    title: 'Viagem',
    seed: 3,
    density: BookDensity.Normal,
    hasCover: false,
    weights: new Map(),
  })
  const upcoming = { shouldLoop: false, nextRound: undefined, isRoundGrowing: false }
  const keys = (state: ReturnType<typeof startPresentation>): readonly string[] =>
    spreadsKept(book, { state, upcoming }).map(({ key }) => key)

  it('should keep the spread on the screen and the next one', () => {
    expect(keys(startPresentation(book.spreads, 2, false))).toStrictEqual(['spread-2', 'spread-3'])
  })

  it('should keep the spread leaving the screen instead of the next one while a page turns', () => {
    const turned = pressInPresentation(startPresentation(book.spreads, 2, false), Right)

    expect(keys(turned)).toStrictEqual(['spread-3', 'spread-2'])
  })

  it('should keep the last spread alone', () => {
    const last = book.spreads.length - 1
    const state = advancePresentation(startPresentation(book.spreads, last, false), upcoming)

    expect(keys(state)).toStrictEqual([`spread-${String(last)}`])
  })
})

describe('photoPagesOf', () => {
  it('should give the pages of photos of the spreads, without the cover', () => {
    const book = planBook(mixedPhotos(30), {
      title: 'Viagem',
      seed: 3,
      density: BookDensity.Normal,
      hasCover: true,
      weights: new Map(),
    })

    expect(photoPagesOf(book.spreads.slice(0, 2))).toStrictEqual(book.pages.slice(0, 3))
  })
})

describe('stripStart', () => {
  it.each([
    [0, 20, 0],
    [3, 20, 0],
    [4, 20, 1],
    [10, 20, 7],
    [19, 20, 13],
    [2, 4, 0],
  ])('should start the strip of 7 around spread %i of %i at %i', (spread, count, start) => {
    expect(stripStart(spread, count, 7)).toBe(start)
  })
})
