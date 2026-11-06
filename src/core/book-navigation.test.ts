import { describe, expect, it } from 'vitest'

import { defined, mixedPhotos, WIDE_PAGE } from '../../test/book-photos.ts'
import type { Rect } from './book-geometry.ts'
import {
  BOOK_CONTROLS,
  type BookAction,
  BookActionKind,
  BookControl,
  type BookFocus,
  type BookPlace,
  BookZone,
  isLayerShown,
  OVERVIEW_CONTROL,
  photoPagesOf,
  PLAY_CONTROL,
  pressInBook,
  spreadRects,
  spreadsKept,
  stripStart,
  withoutLayer,
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

const MIDDLE: BookPlace = { frames: FRAMES, spread: 3, spreadCount: 8, isPlaying: false }
const PLAYING: BookPlace = { ...MIDDLE, isPlaying: true }
// A photo past the last one.
const PAST_THE_LAST = Number.MAX_SAFE_INTEGER

function photo(frame: number): BookFocus {
  return { zone: BookZone.Page, frame }
}

function controls(control: number, frame = 0): BookFocus {
  return { zone: BookZone.Controls, control, frame }
}

function strip(spread: number, frame = 0): BookFocus {
  return { zone: BookZone.Strip, spread, frame }
}

function focusOn(focus: BookFocus): BookAction {
  return { kind: BookActionKind.Focus, focus }
}

describe('pressInBook', () => {
  it('should turn the page with left and right, on the first photo, from any photo', () => {
    for (const from of [0, 2, 4]) {
      expect(pressInBook(photo(from), Right, MIDDLE)).toStrictEqual({
        kind: BookActionKind.Turn,
        key: Right,
        focus: photo(0),
      })
      expect(pressInBook(photo(from), Left, MIDDLE)).toStrictEqual({
        kind: BookActionKind.Turn,
        key: Left,
        focus: photo(0),
      })
    }
  })

  it('should stay on the first and on the last spread', () => {
    expect(pressInBook(photo(2), Left, { ...MIDDLE, spread: 0 })).toStrictEqual(focusOn(photo(2)))
    expect(pressInBook(photo(4), Right, { ...MIDDLE, spread: 7 })).toStrictEqual(focusOn(photo(4)))
  })

  it('should move among the photos with up and down', () => {
    expect(pressInBook(photo(0), Down, MIDDLE)).toStrictEqual(focusOn(photo(1)))
    expect(pressInBook(photo(2), Down, MIDDLE)).toStrictEqual(focusOn(photo(3)))
    expect(pressInBook(photo(3), Up, MIDDLE)).toStrictEqual(focusOn(photo(2)))
    expect(pressInBook(photo(1), Up, MIDDLE)).toStrictEqual(focusOn(photo(0)))
  })

  it('should stay on the first photo with up', () => {
    expect(pressInBook(photo(0), Up, MIDDLE)).toStrictEqual(focusOn(photo(0)))
  })

  it('should show the layer on the overview button, down from the last photo, or with Info', () => {
    expect(pressInBook(photo(4), Down, MIDDLE)).toStrictEqual(
      focusOn(controls(OVERVIEW_CONTROL, 4)),
    )
    expect(pressInBook(photo(1), Info, MIDDLE)).toStrictEqual(
      focusOn(controls(OVERVIEW_CONTROL, 1)),
    )
  })

  it('should open the photo in focus with Enter, and leave the book with Back', () => {
    expect(pressInBook(photo(2), Enter, MIDDLE)).toStrictEqual({
      kind: BookActionKind.Open,
      frame: 2,
    })
    expect(pressInBook(photo(2), Back, MIDDLE)).toStrictEqual({ kind: BookActionKind.Leave })
  })

  it('should take a photo past the last one as the last one', () => {
    expect(pressInBook(photo(PAST_THE_LAST), Enter, MIDDLE)).toStrictEqual({
      kind: BookActionKind.Open,
      frame: 4,
    })
    expect(pressInBook(photo(PAST_THE_LAST), Up, MIDDLE)).toStrictEqual(focusOn(photo(3)))
    expect(pressInBook(controls(1, PAST_THE_LAST), Back, MIDDLE)).toStrictEqual(focusOn(photo(4)))
  })

  it('should move along the buttons, and stop at their ends, keeping the photo', () => {
    const last = BOOK_CONTROLS.length - 1

    expect(pressInBook(controls(1, 3), Left, MIDDLE)).toStrictEqual(focusOn(controls(0, 3)))
    expect(pressInBook(controls(0, 3), Left, MIDDLE)).toStrictEqual(focusOn(controls(0, 3)))
    expect(pressInBook(controls(1, 3), Right, MIDDLE)).toStrictEqual(focusOn(controls(2, 3)))
    expect(pressInBook(controls(last, 3), Right, MIDDLE)).toStrictEqual(focusOn(controls(last, 3)))
  })

  it.each(BOOK_CONTROLS.map((control, index) => [control, index] as const))(
    'should press %s with Enter',
    (control, index) => {
      const after = control === BookControl.Play ? photo(2) : controls(index, 2)

      expect(pressInBook(controls(index, 2), Enter, MIDDLE)).toStrictEqual({
        kind: BookActionKind.Press,
        control,
        focus: after,
      })
    },
  )

  it('should press the overview for a button that is not there', () => {
    expect(pressInBook(controls(9, 2), Enter, MIDDLE)).toStrictEqual({
      kind: BookActionKind.Press,
      control: BookControl.Overview,
      focus: controls(9, 2),
    })
  })

  it('should hide the layer from the bar, back on its photo, and go down to the strip', () => {
    const overview = controls(OVERVIEW_CONTROL, 2)

    expect(pressInBook(overview, Up, MIDDLE)).toStrictEqual(focusOn(photo(2)))
    expect(pressInBook(overview, Back, MIDDLE)).toStrictEqual(focusOn(photo(2)))
    expect(pressInBook(overview, Info, MIDDLE)).toStrictEqual(focusOn(photo(2)))
    expect(pressInBook(overview, Down, MIDDLE)).toStrictEqual(focusOn(strip(3, 2)))
  })

  it('should move along the strip, stopping at its ends, and open a spread with Enter', () => {
    expect(pressInBook(strip(3, 1), Left, MIDDLE)).toStrictEqual(focusOn(strip(2, 1)))
    expect(pressInBook(strip(0, 1), Left, MIDDLE)).toStrictEqual(focusOn(strip(0, 1)))
    expect(pressInBook(strip(3, 1), Right, MIDDLE)).toStrictEqual(focusOn(strip(4, 1)))
    expect(pressInBook(strip(7, 1), Right, MIDDLE)).toStrictEqual(focusOn(strip(7, 1)))
    expect(pressInBook(strip(5, 1), Enter, MIDDLE)).toStrictEqual({
      kind: BookActionKind.Jump,
      spread: 5,
    })
    expect(pressInBook(strip(5, 1), Down, MIDDLE)).toStrictEqual(focusOn(strip(5, 1)))
  })

  it('should leave the strip for the overview button above it, or hide the layer', () => {
    expect(pressInBook(strip(5, 3), Up, MIDDLE)).toStrictEqual(
      focusOn(controls(OVERVIEW_CONTROL, 3)),
    )
    expect(pressInBook(strip(5, 3), Back, MIDDLE)).toStrictEqual(focusOn(photo(3)))
    expect(pressInBook(strip(5, 3), Info, MIDDLE)).toStrictEqual(focusOn(photo(3)))
  })

  it.each([Left, Right, Up, Down, Enter, Info])(
    'should pause the book playing with %s, on the play button of the layer',
    (key) => {
      expect(pressInBook(photo(1), key, PLAYING)).toStrictEqual({
        kind: BookActionKind.Pause,
        focus: controls(PLAY_CONTROL, 1),
      })
      expect(pressInBook(photo(PAST_THE_LAST), key, PLAYING)).toStrictEqual({
        kind: BookActionKind.Pause,
        focus: controls(PLAY_CONTROL, 4),
      })
    },
  )

  it('should leave the book playing with Back', () => {
    expect(pressInBook(photo(1), Back, PLAYING)).toStrictEqual({ kind: BookActionKind.Leave })
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
    expect(PLAY_CONTROL).toBe(1)
  })
})

describe('the layer of the controls', () => {
  it('should show while the focus is on the bar or the strip', () => {
    expect(isLayerShown(photo(2))).toBe(false)
    expect(isLayerShown(controls(1, 2))).toBe(true)
    expect(isLayerShown(strip(1, 2))).toBe(true)
  })

  it('should give the focus back to its photo when it hides', () => {
    const onPhoto = photo(2)

    expect(withoutLayer(onPhoto)).toBe(onPhoto)
    expect(withoutLayer(controls(1, 3))).toStrictEqual(photo(3))
    expect(withoutLayer(strip(4, 0))).toStrictEqual(photo(0))
  })
})

describe('spreadRects', () => {
  const book = planBook(mixedPhotos(40), {
    title: 'Viagem',
    seed: 3,
    density: BookDensity.Normal,
    hasCover: true,
    pageAspect: WIDE_PAGE,
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
    expect(defined(placed).x).toBeCloseTo((1 + first.x) * WIDE_PAGE, 12)
    expect(defined(placed).y).toBe(first.y)
    expect(defined(placed).width).toBeCloseTo(first.width * WIDE_PAGE, 12)
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
      pageAspect: WIDE_PAGE,
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
    pageAspect: WIDE_PAGE,
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

  it('should keep no slide that is not a spread of the book', () => {
    const elsewhere = { key: 'elsewhere', photos: defined(book.spreads[0]).photos }

    expect(keys(startPresentation([elsewhere], 0, false))).toStrictEqual([])
  })
})

describe('photoPagesOf', () => {
  it('should give the pages of photos of the spreads, without the cover', () => {
    const book = planBook(mixedPhotos(30), {
      title: 'Viagem',
      seed: 3,
      density: BookDensity.Normal,
      hasCover: true,
      pageAspect: WIDE_PAGE,
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
