import { describe, expect, it } from 'vitest'

import {
  allLayouts,
  BOOK_OPTIONS,
  CLASSIC_PAGE,
  defined,
  EPSILON,
  isInside,
  mixedPhotos,
  PAGE_SHAPES,
  PANORAMA,
  SQUARE,
  WIDE_PAGE,
} from '../../test/book-photos.ts'
import { type PageGeometry, pageGeometry } from './book-geometry.ts'
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

// How far two boxes of a page stand apart, in page heights: across or down, whichever is more.
function distance(first: Frame, second: Frame, aspect: number): number {
  const { cell: one } = first
  const { cell: other } = second
  const across = Math.max(other.x - one.x - one.width, one.x - other.x - other.width)
  const down = Math.max(other.y - one.y - one.height, one.y - other.y - other.height)
  return Math.max(across * aspect, down)
}

// Inside the margins of the page on its four sides, in fractions of the page.
function expectInsideMargins(frame: Frame, geometry: PageGeometry): void {
  const across = geometry.margin / geometry.aspect
  expect(isInside(frame.cell, PAGE)).toBe(true)
  expect(frame.cell.x).toBeGreaterThanOrEqual(across - EPSILON)
  expect(frame.cell.y).toBeGreaterThanOrEqual(geometry.margin - EPSILON)
  expect(frame.cell.x + frame.cell.width).toBeLessThanOrEqual(1 - across + EPSILON)
  expect(frame.cell.y + frame.cell.height).toBeLessThanOrEqual(1 - geometry.margin + EPSILON)
}

// Every photo of the page, in its order, whole (inside its box, of its own shape: never cut nor
// stretched), inside the margins, and apart from every other by the gap at least: none overlaps.
function expectLaidOut(page: PhotoPage, layout: PageLayout, geometry: PageGeometry): void {
  expect(layout.number).toBe(page.number)
  expect(layout.frames.map(({ photoId }) => photoId)).toStrictEqual(page.photos.map(({ id }) => id))
  zipWith(layout.frames, page.photos, (frame, photo) => {
    expectInsideMargins(frame, geometry)
    expect(isInside(frame.photo, frame.cell)).toBe(true)
    expect((frame.photo.width * geometry.aspect) / frame.photo.height).toBeCloseTo(
      photo.aspectRatio,
      9,
    )
  })
  layout.frames.forEach((frame, index) => {
    for (const other of layout.frames.slice(index + 1)) {
      expect(distance(frame, other, geometry.aspect)).toBeGreaterThanOrEqual(geometry.gap - EPSILON)
    }
  })
}

const DENSITIES = [BookDensity.Light, BookDensity.Normal, BookDensity.Dense]

// Whether the page had another arrangement to take than the page before it: a page of one photo
// has none, a page of two only one, and every few pages one avoids two.
function hasChoice(layout: PageLayout): boolean {
  const count = layout.frames.length
  return count > 2 || (count === 2 && layout.number % 4 !== 1)
}

describe('bookLayouts', () => {
  it.each(
    DENSITIES.flatMap((density) => PAGE_SHAPES.map((pageAspect) => ({ density, pageAspect }))),
  )(
    'should lay each photo out on its page, in order, whole, apart, inside the margins ($density, pages of aspect $pageAspect)',
    ({ density, pageAspect }) => {
      const book = planBook(mixedPhotos(120, 'p', 3), { ...BOOK_OPTIONS, density, pageAspect })
      const layouts = bookLayouts(book)

      expect(layouts.pageAspect).toBe(pageAspect)
      for (const page of book.pages) {
        expectLaidOut(page, layouts.layoutOf(page), pageGeometry(pageAspect))
      }
    },
  )

  it.each(PAGE_SHAPES)(
    'should lay the same book out the same way every time on pages of aspect %d',
    (pageAspect) => {
      const book = (): Book => planBook(mixedPhotos(60), { ...BOOK_OPTIONS, seed: 5, pageAspect })

      expect(allLayouts(book())).toStrictEqual(allLayouts(book()))
    },
  )

  it('should lay the pages out by their shape', () => {
    const photos = mixedPhotos(60)
    const arrangements = (pageAspect: number): readonly string[] =>
      allLayouts(planBook(photos, { ...BOOK_OPTIONS, pageAspect })).map(
        ({ arrangement }) => arrangement,
      )

    expect(arrangements(WIDE_PAGE)).not.toStrictEqual(arrangements(CLASSIC_PAGE))
  })

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
    const before = searchPage(
      defined(pages[3]).photos,
      roundSeed(book.seed, 4),
      pageGeometry(book.pageAspect),
    )
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
      'column(row(1,1),row(1,1),1)',
      'row(1,1)',
      'column(1,row(1,column(row(1,1),1)))',
      'row(column(1,1),column(1,1))',
      '1',
      '1',
      'column(row(1,1),row(1,1,1))',
      'row(column(1,1),column(1,1))',
      '1',
      'row(1,1)',
      'column(1,row(1,column(1,row(1,1))))',
      'column(1,1)',
      'row(column(row(1,1),1,1),column(1,1))',
      'column(row(1,column(1,1)),1)',
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
