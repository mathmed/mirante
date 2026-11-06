import { describe, expect, it } from 'vitest'

import { defined, LANDSCAPE, mixedPhotos, PANORAMA, PORTRAIT } from '../../test/book-photos.ts'
import { BookDensity, paginate, rangeOf } from './book-pagination.ts'

const DENSITIES = [BookDensity.Light, BookDensity.Normal, BookDensity.Dense]

function shaped(
  aspects: readonly number[],
): readonly { id: string; aspectRatio: number; weight: number }[] {
  return aspects.map((aspectRatio, index) => ({ id: `s-${String(index)}`, aspectRatio, weight: 1 }))
}

// The numbers of photos of the facing pages, from the page at this place on.
function spreadCounts(
  pages: readonly (readonly unknown[])[],
  from: number,
): readonly (readonly number[])[] {
  const counts = pages.map((page) => page.length)
  const spreads: (readonly number[])[] = []
  // The last spread may hold what is left: it is left out.
  for (let left = from; left + 2 < counts.length; left += 2) {
    spreads.push(counts.slice(left, left + 2))
  }
  return spreads
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length
}

describe('paginate', () => {
  it.each(DENSITIES)('should keep every photo once, in its order (%s)', (density) => {
    const photos = mixedPhotos(137)

    for (const hasCover of [true, false]) {
      const sut = paginate(photos, { density, seed: 5, hasCover })

      expect(sut.flat()).toStrictEqual(photos)
    }
  })

  it.each(DENSITIES)(
    'should give each page from one photo to the most of its density (%s)',
    (density) => {
      const { most } = rangeOf(density)

      for (const seed of [1, 2, 3, 4]) {
        for (const page of paginate(mixedPhotos(90, 'p', seed), {
          density,
          seed,
          hasCover: true,
        })) {
          expect(page.length).toBeGreaterThanOrEqual(1)
          expect(page.length).toBeLessThanOrEqual(most)
        }
      }
    },
  )

  it('should put more photos on a page as the density grows', () => {
    const photos = mixedPhotos(400)
    const [light, normal, dense] = DENSITIES.map((density) =>
      mean(paginate(photos, { density, seed: 9, hasCover: false }).map((page) => page.length)),
    )

    expect(light).toBeLessThan(normal ?? 0)
    expect(normal).toBeLessThan(dense ?? 0)
  })

  it('should vary the number of photos from page to page', () => {
    const counts = paginate(mixedPhotos(200), {
      density: BookDensity.Normal,
      seed: 3,
      hasCover: false,
    }).map((page) => page.length)

    expect(new Set(counts).size).toBeGreaterThanOrEqual(4)
  })

  it('should let a spread breathe: a page of few photos facing a full one', () => {
    const sut = paginate(shaped(Array(300).fill(LANDSCAPE)), {
      density: BookDensity.Normal,
      seed: 11,
      hasCover: false,
    })
    const { full } = rangeOf(BookDensity.Normal)

    for (const counts of spreadCounts(sut, 0)) {
      expect(Math.min(...counts)).toBeLessThan(full)
      expect(Math.max(...counts)).toBeGreaterThanOrEqual(full)
    }
  })

  it('should count the first page of a book with a cover as the right page of its spread', () => {
    const photos = shaped(Array(300).fill(LANDSCAPE))
    const options = { density: BookDensity.Normal, seed: 11 }
    const withCover = paginate(photos, { ...options, hasCover: true })
    const { full } = rangeOf(BookDensity.Normal)

    // The spreads are the second and third pages, the fourth and fifth...
    for (const counts of spreadCounts(withCover, 1)) {
      expect(Math.min(...counts)).toBeLessThan(full)
      expect(Math.max(...counts)).toBeGreaterThanOrEqual(full)
    }
  })

  it('should count a panorama as two photos', () => {
    const landscapes = paginate(shaped(Array(60).fill(LANDSCAPE)), {
      density: BookDensity.Dense,
      seed: 2,
      hasCover: false,
    })
    const panoramas = paginate(shaped(Array(60).fill(PANORAMA)), {
      density: BookDensity.Dense,
      seed: 2,
      hasCover: false,
    })

    // The same seed asks the same of each page: a page that takes n landscapes takes n / 2
    // panoramas (one, at least). The last pages hold what is left.
    const pages = landscapes.length - 1

    expect(panoramas.slice(0, pages).map((page) => page.length)).toStrictEqual(
      landscapes.slice(0, pages).map((page) => Math.max(1, Math.floor(page.length / 2))),
    )
  })

  it('should bring a second portrait along with a portrait that ends a page', () => {
    const landscapes = paginate(shaped(Array(40).fill(LANDSCAPE)), {
      density: BookDensity.Light,
      seed: 4,
      hasCover: false,
    })
    const portraits = paginate(shaped(Array(40).fill(PORTRAIT)), {
      density: BookDensity.Light,
      seed: 4,
      hasCover: false,
    })
    const [firstLandscapes] = landscapes
    const [firstPortraits] = portraits

    expect(defined(firstPortraits)).toHaveLength(defined(firstLandscapes).length + 1)
  })

  it('should never bring a third portrait along', () => {
    for (const page of paginate(shaped(Array(90).fill(PORTRAIT)), {
      density: BookDensity.Light,
      seed: 8,
      hasCover: false,
    })) {
      expect(page.length).toBeLessThanOrEqual(rangeOf(BookDensity.Light).most)
    }
  })

  it.each([
    [
      BookDensity.Light,
      true,
      [1, 1, 2, 3, 1, 2, 1, 3, 1, 1, 2, 2, 3, 1, 3, 1, 2, 1, 2, 1, 2, 1, 2, 1],
    ],
    [
      BookDensity.Light,
      false,
      [2, 1, 1, 3, 1, 2, 3, 1, 1, 2, 1, 2, 2, 1, 2, 1, 1, 3, 1, 3, 1, 3, 1, 1],
    ],
    [
      BookDensity.Normal,
      true,
      [2, 2, 3, 5, 1, 3, 1, 4, 1, 1, 5, 2, 5, 1, 5, 2, 3, 2, 2, 1, 4, 2, 3],
    ],
    [BookDensity.Normal, false, [3, 1, 1, 5, 2, 3, 5, 2, 1, 4, 3, 2, 4, 1, 3, 1, 2, 6, 1, 5, 1, 4]],
    [BookDensity.Dense, true, [4, 3, 5, 8, 3, 5, 4, 8, 3, 3, 8, 4, 2]],
    [BookDensity.Dense, false, [5, 4, 4, 7, 4, 6, 8, 3, 3, 6, 5, 4, 1]],
  ])(
    'should paginate a %s book (cover: %s) the same way every time',
    (density, hasCover, counts) => {
      const sut = paginate(mixedPhotos(60), { density, seed: 5, hasCover })

      expect(sut.map((page) => page.length).slice(0, counts.length)).toStrictEqual(counts)
    },
  )

  it('should count a photo twice as wide as high as a panorama', () => {
    const options = { density: BookDensity.Dense, seed: 2, hasCover: false }
    const wide = paginate(shaped(Array(60).fill(2)), options)
    const panoramas = paginate(shaped(Array(60).fill(PANORAMA)), options)
    const lessWide = paginate(shaped(Array(60).fill(1.99)), options)
    const landscapes = paginate(shaped(Array(60).fill(LANDSCAPE)), options)

    expect(wide.map((page) => page.length)).toStrictEqual(panoramas.map((page) => page.length))
    expect(lessWide.map((page) => page.length)).toStrictEqual(landscapes.map((page) => page.length))
  })

  it('should pair portraits, never squares nor a landscape and a portrait', () => {
    const options = { density: BookDensity.Light, seed: 4, hasCover: false }
    const counts = (aspects: readonly number[]): readonly number[] =>
      paginate(shaped(aspects), options).map((page) => page.length)
    const landscapes = counts(Array(40).fill(LANDSCAPE))

    expect(counts(Array(40).fill(1))).toStrictEqual(landscapes)
    expect(counts(Array(40).fill(0.99))).not.toStrictEqual(landscapes)
    expect(counts([...Array(20).keys()].flatMap(() => [LANDSCAPE, PORTRAIT]))).not.toStrictEqual(
      counts([...Array(20).keys()].flatMap(() => [PORTRAIT, PORTRAIT])),
    )
    expect(counts([...Array(20).keys()].flatMap(() => [PORTRAIT, LANDSCAPE]))).toStrictEqual(
      counts([...Array(20).keys()].flatMap(() => [LANDSCAPE, PORTRAIT])),
    )
  })

  it('should paginate the same way for the same seed, and another way for another', () => {
    const photos = mixedPhotos(120)
    const options = { density: BookDensity.Normal, hasCover: true }
    const counts = (seed: number): readonly number[] =>
      paginate(photos, { ...options, seed }).map((page) => page.length)

    expect(counts(21)).toStrictEqual(counts(21))
    expect(counts(21)).not.toStrictEqual(counts(22))
  })

  it('should make no page of no photos', () => {
    expect(paginate([], { density: BookDensity.Normal, seed: 1, hasCover: true })).toStrictEqual([])
  })
})

describe('rangeOf', () => {
  it('should know the photos each density puts on a page', () => {
    expect(DENSITIES.map(rangeOf)).toStrictEqual([
      { fewest: 1, full: 2, most: 3 },
      { fewest: 1, full: 3, most: 6 },
      { fewest: 3, full: 5, most: 9 },
    ])
  })

  it('should refuse a density it does not know', () => {
    expect(() => rangeOf('crowded' as BookDensity)).toThrow('No density "crowded"')
  })
})
