import { describe, expect, it } from 'vitest'

import {
  allLayouts,
  BOOK_OPTIONS,
  defined,
  lastOf,
  mixedPhotos,
  PAGE_SHAPES,
  WIDE_PAGE,
} from '../../test/book-photos.ts'
import { BookDensity } from './book-pagination.ts'
import {
  firstPhotoOf,
  type Frame,
  imageSizeOf,
  openingOf,
  PageKind,
  type PhotoPage,
  photosOfBook,
  planBook,
  spreadAt,
  spreadOfPhoto,
} from './book.ts'
import { ImageSize, type Photo } from './photo-library.ts'

function idsOf(pages: readonly PhotoPage[]): readonly string[] {
  return pages.flatMap((page) => page.photos.map(({ id }) => id))
}

describe('planBook', () => {
  it('should open on a cover with the title and the days of the first and last photos', () => {
    const photos = mixedPhotos(20)
    const sut = planBook([...photos].reverse(), BOOK_OPTIONS)

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
    const sut = planBook(mixedPhotos(60), BOOK_OPTIONS)
    const [, ...paired] = sut.spreads

    expect(sut.spreads).toHaveLength(1 + Math.ceil((sut.pages.length - 1) / 2))
    paired.forEach((spread, index) => {
      expect(spread.left).toBe(sut.pages[2 * index + 1])
      expect(spread.right).toBe(sut.pages[2 * index + 2])
    })
  })

  it('should leave the right page of the last spread blank after an odd page', () => {
    const books = [57, 58, 59, 60, 61].map((count) => planBook(mixedPhotos(count), BOOK_OPTIONS))
    // With the cover, an even number of pages leaves the last one alone.
    const alone = defined(books.find((book) => book.pages.length % 2 === 0))
    const paired = defined(books.find((book) => book.pages.length % 2 === 1))

    expect(defined(lastOf(alone.spreads)).right).toBeUndefined()
    expect(defined(lastOf(alone.spreads)).photos).toStrictEqual(defined(lastOf(alone.pages)).photos)
    expect(defined(lastOf(paired.spreads)).right).toBe(lastOf(paired.pages))
  })

  it('should pair the pages from the first one without a cover', () => {
    const sut = planBook(mixedPhotos(60), { ...BOOK_OPTIONS, hasCover: false })

    const [opening] = sut.spreads

    expect(sut.cover).toBeUndefined()
    expect(defined(opening).left).toBe(sut.pages[0])
    expect(defined(opening).right).toBe(sut.pages[1])
    expect(sut.spreads).toHaveLength(Math.ceil(sut.pages.length / 2))
  })

  it('should number the pages of photos from 1 and key the spreads', () => {
    const sut = planBook(mixedPhotos(30), BOOK_OPTIONS)

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
      const sut = planBook(photos, { ...BOOK_OPTIONS, density })

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
      planBook(twice, BOOK_OPTIONS).pages.flatMap((page) => page.photos.map(({ id }) => id)),
    ).toStrictEqual(['b-1', 'b-2'])
  })

  it('should give each photo its weight, 1 when it has none', () => {
    const sut = planBook(mixedPhotos(3), { ...BOOK_OPTIONS, weights: new Map([['b-2', 4]]) })

    expect(sut.pages.flatMap((page) => page.photos.map(({ weight }) => weight))).toStrictEqual([
      1, 4, 1,
    ])
  })

  it('should keep the seed, the density and the shape of the page', () => {
    const sut = planBook(mixedPhotos(3), BOOK_OPTIONS)

    expect([sut.seed, sut.density, sut.pageAspect]).toStrictEqual([
      42,
      BookDensity.Normal,
      WIDE_PAGE,
    ])
    expect(planBook([], { ...BOOK_OPTIONS, pageAspect: 1 }).pageAspect).toBe(1)
  })

  it('should refuse a page that has no shape', () => {
    expect(() => planBook([], { ...BOOK_OPTIONS, pageAspect: 0 })).toThrow(RangeError)
  })

  it('should make an empty book of no photos', () => {
    expect(planBook([], BOOK_OPTIONS)).toMatchObject({ cover: undefined, pages: [], spreads: [] })
  })

  it('should be plain data, the same once written as JSON and read back', () => {
    const sut = planBook(mixedPhotos(40), BOOK_OPTIONS)

    // JSON leaves out what is undefined: the blank page after the last one.
    expect(JSON.parse(JSON.stringify(sut))).toEqual(sut)
    expect(JSON.parse(JSON.stringify(allLayouts(sut)))).toStrictEqual(allLayouts(sut))
  })
})

describe('spreadOfPhoto', () => {
  it('should find the spread a photo is on', () => {
    const sut = planBook(mixedPhotos(40), BOOK_OPTIONS)
    const [, , , spread] = sut.spreads

    expect(spreadOfPhoto(sut, defined(lastOf(defined(spread).photos)).id)).toBe(3)
  })

  it('should fall back on the first spread for a photo the book does not have', () => {
    expect(spreadOfPhoto(planBook(mixedPhotos(40), BOOK_OPTIONS), 'elsewhere')).toBe(0)
  })
})

describe('photosOfBook', () => {
  it('should give every photo of the book in its order', () => {
    const photos = mixedPhotos(25)

    expect(photosOfBook(planBook(photos, BOOK_OPTIONS)).map(({ id }) => id)).toStrictEqual(
      photos.map(({ id }) => id),
    )
  })
})

describe('openingOf', () => {
  const book = planBook(mixedPhotos(40), BOOK_OPTIONS)

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
    expect(openingOf(planBook([], BOOK_OPTIONS), undefined)).toStrictEqual({ spread: 0, frame: 0 })
  })
})

describe('spreadAt and firstPhotoOf', () => {
  const book = planBook(mixedPhotos(40), BOOK_OPTIONS)

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
  function frameOf(width: number, height: number, pageAspect: number): Frame {
    const photo = { x: 0, y: 0, width: width / pageAspect, height }
    return { photoId: 'p', weight: 1, cell: photo, photo }
  }

  // Under 30% of the height of the page on its shorter side, a photo is small.
  const SIZES: readonly {
    readonly width: number
    readonly height: number
    readonly size: ImageSize
  }[] = [
    { width: 0.2, height: 0.1, size: ImageSize.Thumbnail },
    { width: 0.29, height: 0.9, size: ImageSize.Thumbnail },
    { width: 0.9, height: 0.29, size: ImageSize.Thumbnail },
    { width: 0.3, height: 0.9, size: ImageSize.Preview },
    { width: 0.9, height: 0.3, size: ImageSize.Preview },
    { width: 0.85, height: 0.8, size: ImageSize.Preview },
  ]

  it.each(PAGE_SHAPES.flatMap((pageAspect) => SIZES.map((sized) => ({ ...sized, pageAspect }))))(
    'should load a photo of $width by $height page heights at the $size size (page of aspect $pageAspect)',
    ({ width, height, size, pageAspect }) => {
      expect(imageSizeOf(frameOf(width, height, pageAspect), pageAspect)).toBe(size)
    },
  )
})
