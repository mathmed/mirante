import type { Rect } from '../src/core/book-geometry.ts'
import { BookDensity } from '../src/core/book-pagination.ts'
import { type Book, bookLayouts, type BookOptions, type PageLayout } from '../src/core/book.ts'
import type { Photo } from '../src/core/photo-library.ts'

// Photos of every shape a book meets, for the tests of the book: width over height.
export const PORTRAIT = 2 / 3
export const LANDSCAPE = 3 / 2
export const SQUARE = 1
export const PANORAMA = 3
export const NARROW = 0.35
const WIDE = 16 / 9
const TALL = 3 / 4

// A mix in no particular rhythm, as an album has them.
const MIX: readonly number[] = [
  LANDSCAPE,
  PORTRAIT,
  LANDSCAPE,
  SQUARE,
  PANORAMA,
  PORTRAIT,
  PORTRAIT,
  WIDE,
  NARROW,
  LANDSCAPE,
  TALL,
  LANDSCAPE,
  SQUARE,
  WIDE,
  PORTRAIT,
  LANDSCAPE,
  LANDSCAPE,
  PANORAMA,
  TALL,
  NARROW,
  LANDSCAPE,
  WIDE,
  SQUARE,
]

const DAY_MS = 86_400_000
const MARCH_2024 = Date.UTC(2024, 2, 1)
const DAYS_IN_ANY_MONTH = 28

// Photos taken a day apart from March 1st 2024, named <prefix>-1, <prefix>-2..., of the mix's shapes
// in turn, starting at a place of the mix.
export function mixedPhotos(count: number, prefix = 'b', start = 0): readonly Photo[] {
  return [...Array(count).keys()].map((index) => ({
    id: `${prefix}-${String(index + 1)}`,
    takenAtMs: MARCH_2024 + index * DAY_MS,
    date: { year: 2024, month: 3, day: (index % DAYS_IN_ANY_MONTH) + 1 },
    aspectRatio: MIX[(start + index) % MIX.length] ?? SQUARE,
  }))
}

// Every shape in turn, from the mix, for a page of this many photos.
export function mixedAspects(count: number, start = 0): readonly number[] {
  return mixedPhotos(count, 'a', start).map((photo) => photo.aspectRatio)
}

// Under this, two lengths are the same: the sums of the layout round off.
export const EPSILON = 1e-9

// Whether two boxes stand apart by at least the gap, side by side or one above the other.
export function isApart(first: Rect, second: Rect, gap: number): boolean {
  return (
    first.x + first.width + gap <= second.x + EPSILON ||
    second.x + second.width + gap <= first.x + EPSILON ||
    first.y + first.height + gap <= second.y + EPSILON ||
    second.y + second.height + gap <= first.y + EPSILON
  )
}

export function isInside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x - EPSILON &&
    inner.y >= outer.y - EPSILON &&
    inner.x + inner.width <= outer.x + outer.width + EPSILON &&
    inner.y + inner.height <= outer.y + outer.height + EPSILON
  )
}

// What the test expects to be there.
export function defined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Expected a value')
  }
  return value
}

// The last item of a list (Array.prototype.at is newer than the core's library).
export function lastOf<T>(items: readonly T[]): T | undefined {
  const [last] = items.slice(-1)
  return last
}

// The options of the books of the tests: a cover, the normal density, a seed, every weight 1.
export const BOOK_OPTIONS: BookOptions = {
  title: 'Viagem a Lisboa',
  seed: 42,
  density: BookDensity.Normal,
  hasCover: true,
  weights: new Map(),
}

// Every page of the book, laid out in its order.
export function allLayouts(book: Book): readonly PageLayout[] {
  const layouts = bookLayouts(book)
  return book.pages.map((page) => layouts.layoutOf(page))
}
