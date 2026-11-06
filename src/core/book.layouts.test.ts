import { describe, expect, it } from 'vitest'

import {
  allLayouts,
  BOOK_OPTIONS,
  defined,
  EPSILON,
  isInside,
  mixedPhotos,
  PANORAMA,
  SQUARE,
} from '../../test/book-photos.ts'
import { GAP, MARGIN, PAGE_ASPECT } from './book-geometry.ts'
import { BookDensity } from './book-pagination.ts'
import {
  type Book,
  bookLayouts,
  type Frame,
  PageKind,
  type PageLayout,
  type PhotoPage,
  planBook,
} from './book.ts'
import { zipWith } from './lists.ts'
import { searchPage } from './page-layout.ts'
import { roundSeed } from './shuffle.ts'

const PAGE = { x: 0, y: 0, width: 1, height: 1 }
// The margin across, in fractions of the width of the page.
const MARGIN_ACROSS = MARGIN / PAGE_ASPECT

// How far two boxes of a page stand apart, in page heights: across or down, whichever is more.
function distance(first: Frame, second: Frame): number {
  const { cell: one } = first
  const { cell: other } = second
  const across = Math.max(other.x - one.x - one.width, one.x - other.x - other.width)
  const down = Math.max(other.y - one.y - one.height, one.y - other.y - other.height)
  return Math.max(across * PAGE_ASPECT, down)
}

function expectLaidOut(page: PhotoPage, layout: PageLayout): void {
  expect(layout.number).toBe(page.number)
  expect(layout.frames.map(({ photoId }) => photoId)).toStrictEqual(page.photos.map(({ id }) => id))
  zipWith(layout.frames, page.photos, (frame, photo) => {
    expect(isInside(frame.cell, PAGE)).toBe(true)
    expect(frame.cell.x).toBeGreaterThanOrEqual(MARGIN_ACROSS - EPSILON)
    expect(frame.cell.y).toBeGreaterThanOrEqual(MARGIN - EPSILON)
    expect(isInside(frame.photo, frame.cell)).toBe(true)
    expect((frame.photo.width * PAGE_ASPECT) / frame.photo.height).toBeCloseTo(photo.aspectRatio, 9)
  })
  layout.frames.forEach((frame, index) => {
    for (const other of layout.frames.slice(index + 1)) {
      expect(distance(frame, other)).toBeGreaterThanOrEqual(GAP - EPSILON)
    }
  })
}

// Whether the page had another arrangement to take than the page before it: a page of one photo
// has none, a page of two only one, and every few pages one avoids two.
function hasChoice(layout: PageLayout): boolean {
  const count = layout.frames.length
  return count > 2 || (count === 2 && layout.number % 4 !== 1)
}

describe('bookLayouts', () => {
  it.each([BookDensity.Light, BookDensity.Normal, BookDensity.Dense])(
    'should lay each photo out on its page, whole, apart, inside the margins (%s)',
    (density) => {
      const book = planBook(mixedPhotos(120, 'p', 3), { ...BOOK_OPTIONS, density })
      const layouts = bookLayouts(book)

      for (const page of book.pages) {
        expectLaidOut(page, layouts.layoutOf(page))
      }
    },
  )

  it('should carry the weight of each photo', () => {
    const book = planBook(mixedPhotos(3), { ...BOOK_OPTIONS, weights: new Map([['b-1', 3]]) })

    expect(
      allLayouts(book).flatMap(({ frames }) => frames.map(({ weight }) => weight)),
    ).toStrictEqual([3, 1, 1])
  })

  it.each([1, 2, 3, 5, 8, 13])(
    'should never repeat the arrangement of the page before (seed %i)',
    (seed) => {
      const layouts = allLayouts(planBook(mixedPhotos(240, 'p', seed), { ...BOOK_OPTIONS, seed }))

      zipWith(layouts.slice(1), layouts, (layout, previous) => {
        expect(hasChoice(layout) && layout.arrangement === previous.arrangement).toBe(false)
      })
    },
  )

  it('should lay a page that anchors the others out apart from the two best of the page before', () => {
    const shapes = [PANORAMA, SQUARE, SQUARE]
    const pages = [1, 2, 3, 4, 5].map((number): PhotoPage => {
      const [first, ...rest] = shapes.map((aspectRatio, index) => ({
        ...defined(mixedPhotos(1, `p${String(number)}-${String(index)}`)[0]),
        aspectRatio,
        weight: 1,
      }))
      return { kind: PageKind.Photos, number, photos: [defined(first), ...rest] }
    })
    const book: Book = { ...planBook([], BOOK_OPTIONS), pages }
    const before = searchPage(defined(pages[3]).photos, roundSeed(book.seed, 4))
    const ranked = [before.best, ...before.others].map(({ signature }) => signature)

    const sut = bookLayouts(book).layoutOf(defined(pages[4]))

    // The same photos rank the same arrangements: the third best is the best one left.
    expect(ranked.indexOf(sut.arrangement)).toBe(2)
  })

  it('should lay the pages out the same way every time', () => {
    const book = planBook(mixedPhotos(90), { ...BOOK_OPTIONS, seed: 9 })

    expect(
      allLayouts(book)
        .slice(0, 14)
        .map(({ arrangement }) => arrangement),
    ).toStrictEqual([
      'row(column(1,row(1,1)),column(1,1))',
      'row(1,1)',
      'row(column(1,row(1,1)),column(1,1))',
      'column(row(1,1),row(1,1))',
      '1',
      '1',
      'column(row(1,1,1),row(1,1))',
      'column(row(1,1),row(1,1))',
      '1',
      'row(1,1)',
      'row(column(1,row(1,1)),column(1,1))',
      'row(1,1)',
      'row(column(row(1,1),row(column(1,1),1)),1)',
      'row(column(1,1),column(1,1))',
    ])
  })

  it('should vary the arrangements across the book', () => {
    const layouts = allLayouts(planBook(mixedPhotos(160), BOOK_OPTIONS))

    // Pages of one or two photos have one or two ways; the others vary.
    expect(new Set(layouts.map(({ arrangement }) => arrangement)).size).toBeGreaterThanOrEqual(12)
  })

  it('should lay a page out the same way whatever was laid out before it', () => {
    const book = planBook(mixedPhotos(300), BOOK_OPTIONS)
    const inOrder = allLayouts(book)
    const sut = bookLayouts(book)

    expect([...book.pages].reverse().map((page) => sut.layoutOf(page))).toStrictEqual(
      [...inOrder].reverse(),
    )
  })

  it('should make the same book for the same seed, and another for another', () => {
    const photos = mixedPhotos(80)
    const arrangements = (seed: number): readonly string[] =>
      allLayouts(planBook(photos, { ...BOOK_OPTIONS, seed })).map(({ arrangement }) => arrangement)

    expect(arrangements(7)).toStrictEqual(arrangements(7))
    expect(arrangements(7)).not.toStrictEqual(arrangements(8))
  })

  it('should lay out only the pages asked for and the few before them', () => {
    const book = planBook(mixedPhotos(5000), BOOK_OPTIONS)
    const sut = bookLayouts(book)
    const page = defined(book.pages[700])

    sut.layoutOf(page)

    expect(sut.isLaidOut(page)).toBe(true)
    expect(book.pages.filter((candidate) => sut.isLaidOut(candidate)).length).toBeLessThanOrEqual(4)
  })

  it('should lay out a page once', () => {
    const book = planBook(mixedPhotos(10), BOOK_OPTIONS)
    const sut = bookLayouts(book)
    const page = defined(book.pages[0])

    expect(sut.layoutOf(page)).toBe(sut.layoutOf(page))
  })
})
