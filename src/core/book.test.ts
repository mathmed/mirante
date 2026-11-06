import { describe, expect, it } from 'vitest'

import { defined, EPSILON, isInside, lastOf, mixedPhotos } from '../../test/book-photos.ts'
import { GAP, MARGIN, PAGE_ASPECT } from './book-geometry.ts'
import { BookDensity } from './book-pagination.ts'
import {
  type Book,
  bookLayouts,
  type BookOptions,
  firstPhotoOf,
  type Frame,
  imageSizeOf,
  openingOf,
  PageKind,
  type PageLayout,
  type PhotoPage,
  photosOfBook,
  planBook,
  spreadAt,
  spreadOfPhoto,
} from './book.ts'
import { zipWith } from './lists.ts'
import { ImageSize, type Photo } from './photo-library.ts'

const OPTIONS: BookOptions = {
  title: 'Viagem a Lisboa',
  seed: 42,
  density: BookDensity.Normal,
  hasCover: true,
  weights: new Map(),
}

const PAGE = { x: 0, y: 0, width: 1, height: 1 }
// The margin across, in fractions of the width of the page.
const MARGIN_ACROSS = MARGIN / PAGE_ASPECT

function allLayouts(book: Book): readonly PageLayout[] {
  const layouts = bookLayouts(book)
  return book.pages.map((page) => layouts.layoutOf(page))
}

function idsOf(pages: readonly PhotoPage[]): readonly string[] {
  return pages.flatMap((page) => page.photos.map(({ id }) => id))
}

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

describe('planBook', () => {
  it('should open on a cover with the title and the days of the first and last photos', () => {
    const photos = mixedPhotos(20)
    const sut = planBook([...photos].reverse(), OPTIONS)

    expect(sut.cover).toStrictEqual({
      kind: PageKind.Cover,
      title: 'Viagem a Lisboa',
      first: { year: 2024, month: 3, day: 1 },
      last: { year: 2024, month: 3, day: 20 },
    })
    const [opening] = sut.spreads

    expect(defined(opening).left).toBe(sut.cover)
    expect(defined(opening).right).toBe(sut.pages[0])
  })

  it('should pair the pages two by two after the cover, the last one alone', () => {
    const sut = planBook(mixedPhotos(60), OPTIONS)
    const [, ...paired] = sut.spreads

    expect(sut.spreads).toHaveLength(1 + Math.ceil((sut.pages.length - 1) / 2))
    paired.forEach((spread, index) => {
      expect(spread.left).toBe(sut.pages[2 * index + 1])
      expect(spread.right).toBe(sut.pages[2 * index + 2])
    })
  })

  it('should leave the right page of the last spread blank after an odd page', () => {
    const books = [57, 58, 59, 60, 61].map((count) => planBook(mixedPhotos(count), OPTIONS))
    // With the cover, an even number of pages leaves the last one alone.
    const alone = defined(books.find((book) => book.pages.length % 2 === 0))
    const paired = defined(books.find((book) => book.pages.length % 2 === 1))

    expect(defined(lastOf(alone.spreads)).right).toBeUndefined()
    expect(defined(lastOf(alone.spreads)).photos).toStrictEqual(defined(lastOf(alone.pages)).photos)
    expect(defined(lastOf(paired.spreads)).right).toBe(lastOf(paired.pages))
  })

  it('should pair the pages from the first one without a cover', () => {
    const sut = planBook(mixedPhotos(60), { ...OPTIONS, hasCover: false })

    const [opening] = sut.spreads

    expect(sut.cover).toBeUndefined()
    expect(defined(opening).left).toBe(sut.pages[0])
    expect(defined(opening).right).toBe(sut.pages[1])
    expect(sut.spreads).toHaveLength(Math.ceil(sut.pages.length / 2))
  })

  it('should number the pages of photos from 1 and key the spreads', () => {
    const sut = planBook(mixedPhotos(30), OPTIONS)

    expect(sut.pages.map((page) => page.number)).toStrictEqual(
      [...sut.pages.keys()].map((index) => index + 1),
    )
    expect(sut.spreads.map((spread) => spread.key)).toStrictEqual(
      [...sut.spreads.keys()].map((index) => `spread-${String(index)}`),
    )
  })

  it.each([BookDensity.Light, BookDensity.Normal, BookDensity.Dense])(
    'should keep every photo of the album once, in its order (%s)',
    (density) => {
      const photos = mixedPhotos(173)
      const sut = planBook(photos, { ...OPTIONS, density })

      expect(idsOf(sut.pages)).toStrictEqual(photos.map(({ id }) => id))
      expect(sut.spreads.flatMap((spread) => spread.photos.map(({ id }) => id))).toStrictEqual(
        photos.map(({ id }) => id),
      )
    },
  )

  it('should leave out a photo the album lists twice', () => {
    const [first, second] = mixedPhotos(2)
    const twice = [first, second, first].filter((photo): photo is Photo => photo !== undefined)

    expect(
      planBook(twice, OPTIONS).pages.flatMap((page) => page.photos.map(({ id }) => id)),
    ).toStrictEqual(['b-1', 'b-2'])
  })

  it('should give each photo its weight, 1 when it has none', () => {
    const sut = planBook(mixedPhotos(3), { ...OPTIONS, weights: new Map([['b-2', 4]]) })

    expect(sut.pages.flatMap((page) => page.photos.map(({ weight }) => weight))).toStrictEqual([
      1, 4, 1,
    ])
  })

  it('should keep the seed, the density and the shape of the page', () => {
    const sut = planBook(mixedPhotos(3), OPTIONS)

    expect([sut.seed, sut.density, sut.pageAspect]).toStrictEqual([
      42,
      BookDensity.Normal,
      PAGE_ASPECT,
    ])
  })

  it('should make an empty book of no photos', () => {
    expect(planBook([], OPTIONS)).toMatchObject({ cover: undefined, pages: [], spreads: [] })
  })

  it('should be plain data, the same once written as JSON and read back', () => {
    const sut = planBook(mixedPhotos(40), OPTIONS)

    // JSON leaves out what is undefined: the blank page after the last one.
    expect(JSON.parse(JSON.stringify(sut))).toEqual(sut)
    expect(JSON.parse(JSON.stringify(allLayouts(sut)))).toStrictEqual(allLayouts(sut))
  })
})

describe('spreadOfPhoto', () => {
  it('should find the spread a photo is on', () => {
    const sut = planBook(mixedPhotos(40), OPTIONS)
    const [, , , spread] = sut.spreads

    expect(spreadOfPhoto(sut, defined(lastOf(defined(spread).photos)).id)).toBe(3)
  })

  it('should fall back on the first spread for a photo the book does not have', () => {
    expect(spreadOfPhoto(planBook(mixedPhotos(40), OPTIONS), 'elsewhere')).toBe(0)
  })
})

describe('photosOfBook', () => {
  it('should give every photo of the book in its order', () => {
    const photos = mixedPhotos(25)

    expect(photosOfBook(planBook(photos, OPTIONS)).map(({ id }) => id)).toStrictEqual(
      photos.map(({ id }) => id),
    )
  })
})

describe('openingOf', () => {
  const book = planBook(mixedPhotos(40), OPTIONS)

  it('should open on the spread of the photo, with the focus on it', () => {
    const [, , spread] = book.spreads
    const [, second] = defined(spread).photos

    expect(openingOf(book, defined(second).id)).toStrictEqual({ spread: 2, frame: 1 })
  })

  it('should open on the first photo for a photo the book does not have, or none', () => {
    expect(openingOf(book, 'elsewhere')).toStrictEqual({ spread: 0, frame: 0 })
    expect(openingOf(book, undefined)).toStrictEqual({ spread: 0, frame: 0 })
  })

  it('should open an empty book on nothing', () => {
    expect(openingOf(planBook([], OPTIONS), undefined)).toStrictEqual({ spread: 0, frame: 0 })
  })
})

describe('spreadAt and firstPhotoOf', () => {
  const book = planBook(mixedPhotos(40), OPTIONS)

  it('should find a spread, and its first photo', () => {
    const [, spread] = book.spreads

    expect(spreadAt(book, 1)).toBe(spread)
    expect(firstPhotoOf(book, 1)).toBe(defined(spread).photos[0].id)
  })

  it('should find nothing past the last spread', () => {
    expect(spreadAt(book, book.spreads.length)).toBeUndefined()
    expect(firstPhotoOf(book, book.spreads.length)).toBeUndefined()
  })
})

describe('imageSizeOf', () => {
  function frameOf(width: number, height: number): Frame {
    const photo = { x: 0, y: 0, width: width / PAGE_ASPECT, height }
    return { photoId: 'p', weight: 1, cell: photo, photo }
  }

  it.each([
    [0.3, 0.2, ImageSize.Thumbnail],
    [0.39, 0.9, ImageSize.Thumbnail],
    [0.9, 0.39, ImageSize.Thumbnail],
    [0.4, 0.9, ImageSize.Preview],
    [0.9, 0.4, ImageSize.Preview],
    [1.1, 0.8, ImageSize.Preview],
  ])('should load a photo of %f by %f page heights at the %s size', (width, height, size) => {
    expect(imageSizeOf(frameOf(width, height))).toBe(size)
  })
})

describe('bookLayouts', () => {
  it.each([BookDensity.Light, BookDensity.Normal, BookDensity.Dense])(
    'should lay each photo out on its page, whole, apart, inside the margins (%s)',
    (density) => {
      const book = planBook(mixedPhotos(120, 'p', 3), { ...OPTIONS, density })
      const layouts = bookLayouts(book)

      for (const page of book.pages) {
        expectLaidOut(page, layouts.layoutOf(page))
      }
    },
  )

  it('should carry the weight of each photo', () => {
    const book = planBook(mixedPhotos(3), { ...OPTIONS, weights: new Map([['b-1', 3]]) })

    expect(
      allLayouts(book).flatMap(({ frames }) => frames.map(({ weight }) => weight)),
    ).toStrictEqual([3, 1, 1])
  })

  it.each([1, 2, 3, 5, 8, 13])(
    'should never repeat the arrangement of the page before (seed %i)',
    (seed) => {
      const layouts = allLayouts(planBook(mixedPhotos(240, 'p', seed), { ...OPTIONS, seed }))

      zipWith(layouts.slice(1), layouts, (layout, previous) => {
        expect(hasChoice(layout) && layout.arrangement === previous.arrangement).toBe(false)
      })
    },
  )

  it('should lay the pages out the same way every time', () => {
    const book = planBook(mixedPhotos(90), { ...OPTIONS, seed: 9 })

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
    const layouts = allLayouts(planBook(mixedPhotos(160), OPTIONS))

    // Pages of one or two photos have one or two ways; the others vary.
    expect(new Set(layouts.map(({ arrangement }) => arrangement)).size).toBeGreaterThanOrEqual(12)
  })

  it('should lay a page out the same way whatever was laid out before it', () => {
    const book = planBook(mixedPhotos(300), OPTIONS)
    const inOrder = allLayouts(book)
    const sut = bookLayouts(book)

    expect([...book.pages].reverse().map((page) => sut.layoutOf(page))).toStrictEqual(
      [...inOrder].reverse(),
    )
  })

  it('should make the same book for the same seed, and another for another', () => {
    const photos = mixedPhotos(80)
    const arrangements = (seed: number): readonly string[] =>
      allLayouts(planBook(photos, { ...OPTIONS, seed })).map(({ arrangement }) => arrangement)

    expect(arrangements(7)).toStrictEqual(arrangements(7))
    expect(arrangements(7)).not.toStrictEqual(arrangements(8))
  })

  it('should lay out only the pages asked for and the few before them', () => {
    const book = planBook(mixedPhotos(5000), OPTIONS)
    const sut = bookLayouts(book)
    const page = defined(book.pages[700])

    sut.layoutOf(page)

    expect(sut.isLaidOut(page)).toBe(true)
    expect(book.pages.filter((candidate) => sut.isLaidOut(candidate)).length).toBeLessThanOrEqual(4)
  })

  it('should lay out a page once', () => {
    const book = planBook(mixedPhotos(10), OPTIONS)
    const sut = bookLayouts(book)
    const page = defined(book.pages[0])

    expect(sut.layoutOf(page)).toBe(sut.layoutOf(page))
  })
})
