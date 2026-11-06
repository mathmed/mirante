import { describe, expect, it } from 'vitest'

import {
  defined,
  EPSILON,
  isApart,
  isInside,
  LANDSCAPE,
  mixedAspects,
  NARROW,
  PANORAMA,
  PORTRAIT,
  SQUARE,
} from '../../test/book-photos.ts'
import { areaOf, CONTENT, GAP, MARGIN, PAGE_ASPECT } from './book-geometry.ts'
import { zipWith } from './lists.ts'
import { arrangementsOf, signatureOf } from './page-arrangement.ts'
import { MAX_TRIED, type PageCandidate, type PagePhoto, searchPage } from './page-layout.ts'
import { randomSequence } from './shuffle.ts'

function page(
  aspects: readonly number[],
  weights: readonly number[] = [],
): readonly [PagePhoto, ...PagePhoto[]] {
  const photos = aspects.map((aspectRatio, index) => {
    const [weight = 1] = weights.slice(index, index + 1)
    return { aspectRatio, weight }
  })
  const [first, ...rest] = photos
  if (first === undefined) {
    throw new Error('a page has photos')
  }
  return [first, ...rest]
}

function areas(candidate: PageCandidate): readonly number[] {
  return candidate.placements.map(({ photo }) => areaOf(photo))
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

// The cost as documented: the share of the room left empty, 0.6 times half the distance between
// the shares of the area and those of the weights, twice the shortfall of each photo under 4% of
// the room (in shares of 4%), and 0.06 times the seed's draw for the arrangement.
function documentedCost(
  candidate: PageCandidate,
  weights: readonly number[],
  draw: number,
): number {
  const room = areaOf(CONTENT)
  const photoAreas = areas(candidate)
  const total = sum(photoAreas)
  const imbalance = sum(
    zipWith(photoAreas, weights, (area, weight) => Math.abs(area / total - weight / sum(weights))),
  )
  const shortfall = sum(photoAreas.map((area) => Math.max(0, 0.04 - area / room)))
  return 1 - total / room + 0.6 * 0.5 * imbalance + (2 * shortfall) / 0.04 + 0.06 * draw
}

// The seed's draw for an arrangement: one draw for each arrangement, in the order they are found.
function drawFor(aspects: readonly number[], signature: string, seed: number): number {
  const random = randomSequence(seed)
  const order = arrangementsOf(aspects, GAP).map(signatureOf)
  const draws = order.map(() => random())
  return draws[order.indexOf(signature)] ?? Number.NaN
}

// Pages of one to nine photos of every shape, from several places of the mix, and seeds.
const PAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((count) =>
  [0, 4, 9, 15].map((start) => ({ count, start, seed: count * 31 + start })),
)

describe('searchPage', () => {
  it.each(PAGES)(
    'should keep $count photos (from $start of the mix) whole, apart and inside the margins',
    ({ count, start, seed }) => {
      const aspects = mixedAspects(count, start)
      const { best, others } = searchPage(page(aspects), seed)

      for (const candidate of [best, ...others]) {
        expect(candidate.placements).toHaveLength(count)
        zipWith(candidate.placements, aspects, ({ cell, photo }, aspect) => {
          expect(isInside(cell, CONTENT)).toBe(true)
          expect(isInside(photo, cell)).toBe(true)
          expect(photo.width / photo.height).toBeCloseTo(aspect, 9)
          expect(areaOf(photo)).toBeGreaterThan(EPSILON)
        })
        candidate.placements.forEach(({ cell }, index) => {
          candidate.placements.slice(index + 1).forEach((other) => {
            expect(isApart(cell, other.cell, GAP)).toBe(true)
          })
        })
      }
    },
  )

  it.each(PAGES)(
    'should score at most MAX_TRIED arrangements for $count photos',
    ({ count, start, seed }) => {
      expect(searchPage(page(mixedAspects(count, start)), seed).tried).toBeLessThanOrEqual(
        MAX_TRIED,
      )
    },
  )

  it('should score every arrangement of up to six photos', () => {
    expect(searchPage(page(mixedAspects(6)), 1).tried).toBe(394)
  })

  it('should stop scoring the halves of a full page when they reach their part of the budget', () => {
    // The halves stop at 1711 (MAX_TRIED less what pairing them may take), and the halves found
    // make 259 pairs; every other half is one column.
    expect(searchPage(page(mixedAspects(9)), 1).tried).toBe(1970)
  })

  it('should give the same layout for the same seed', () => {
    const aspects = mixedAspects(5, 2)

    expect(searchPage(page(aspects), 12)).toStrictEqual(searchPage(page(aspects), 12))
  })

  it('should vary with the seed among close arrangements', () => {
    const aspects = [SQUARE, SQUARE, SQUARE, SQUARE, SQUARE]
    const signatures = new Set(
      [...Array(12).keys()].map((seed) => searchPage(page(aspects), seed).best.signature),
    )

    expect(signatures.size).toBeGreaterThan(1)
  })

  it('should rank the best first, then two other arrangements', () => {
    const { best, others } = searchPage(page(mixedAspects(4)), 3)

    const [second, third] = others

    expect(others).toHaveLength(2)
    expect(new Set([best, ...others].map(({ signature }) => signature)).size).toBe(3)
    expect(best.cost).toBeLessThanOrEqual(defined(second).cost)
    expect(defined(second).cost).toBeLessThanOrEqual(defined(third).cost)
  })

  it('should give a single photo the whole width of the page, in the middle of its height', () => {
    const { best, others } = searchPage(page([LANDSCAPE]), 1)
    const { photo } = defined(best.placements[0])

    expect(best.signature).toBe('1')
    expect(others).toStrictEqual([])
    expect(photo.x).toBeCloseTo(MARGIN, 12)
    expect(photo.width).toBeCloseTo(PAGE_ASPECT - 2 * MARGIN, 12)
    expect(photo.y + photo.height / 2).toBeCloseTo(0.5, 12)
  })

  it('should give a tall photo the whole height of the page, in the middle of its width', () => {
    const { photo } = defined(searchPage(page([PORTRAIT]), 1).best.placements[0])

    expect(photo.y).toBeCloseTo(MARGIN, 12)
    expect(photo.height).toBeCloseTo(1 - 2 * MARGIN, 12)
    expect(photo.x + photo.width / 2).toBeCloseTo(PAGE_ASPECT / 2, 12)
  })

  it('should stand two portraits side by side and stack two panoramas', () => {
    expect(searchPage(page([PORTRAIT, PORTRAIT]), 1).best.signature).toBe('row(1,1)')
    expect(searchPage(page([PANORAMA, PANORAMA]), 1).best.signature).toBe('column(1,1)')
  })

  it('should put a portrait beside two landscapes stacked', () => {
    expect(searchPage(page([PORTRAIT, LANDSCAPE, LANDSCAPE]), 1).best.signature).toBe(
      'row(1,column(1,1))',
    )
  })

  it('should cost the room the photos leave empty', () => {
    const { best } = searchPage(page([PORTRAIT, PORTRAIT]), 1)
    const used = areas(best).reduce((total, area) => total + area, 0) / areaOf(CONTENT)

    // Two equal photos, of a fair size: only the empty room and the seed count.
    expect(best.cost).toBeGreaterThanOrEqual(1 - used)
    expect(best.cost).toBeLessThan(1 - used + 0.06)
  })

  it('should cost the empty room, the shares off their weights, the small photos and the seed', () => {
    const aspects = [PANORAMA, PANORAMA, NARROW, NARROW, PANORAMA, NARROW]
    const weights = [4, 1, 1, 1, 1, 1]
    const { best, others } = searchPage(page(aspects, weights), 3)

    expect(Math.min(...others.flatMap(areas)) / areaOf(CONTENT)).toBeLessThan(0.04)
    for (const candidate of [best, ...others]) {
      const draw = drawFor(aspects, candidate.signature, 3)
      expect(candidate.cost).toBeCloseTo(documentedCost(candidate, weights, draw), 12)
    }
  })

  it.each([
    {
      count: 7,
      seed: 1,
      signature: 'column(row(1,1,1),row(column(1,1),1,1))',
      tried: 673,
      cost: 0.267_115_378_196_391_75,
    },
    {
      count: 8,
      seed: 1,
      signature: 'row(column(1,row(1,column(1,1))),column(1,row(1,1),1))',
      tried: 689,
      cost: 0.300_549_303_453_545_14,
    },
    {
      count: 8,
      seed: 6,
      signature: 'row(column(row(1,1),row(1,1),1),column(row(1,1),1))',
      tried: 689,
      cost: 0.316_754_302_233_643,
    },
    {
      count: 9,
      seed: 1,
      signature: 'column(row(1,1,1),row(column(row(1,1),row(1,1,1)),1))',
      tried: 1970,
      cost: 0.284_710_975_534_313_07,
    },
  ])(
    'should pair the best halves of a page of $count photos the same way every time (seed $seed)',
    ({ count, seed, signature, tried, cost }) => {
      const sut = searchPage(page(mixedAspects(count)), seed)

      expect(sut.best.signature).toBe(signature)
      expect(sut.tried).toBe(tried)
      expect(sut.best.cost).toBeCloseTo(cost, 12)
    },
  )

  it('should give the shares of their weights to the photos of each half', () => {
    const weights = [5, 1, 1, 1, 1, 1, 1, 1, 1]
    const { best } = searchPage(page(mixedAspects(9, 3), weights), 2)

    expect(best.signature).toBe('row(column(row(1,column(1,row(1,1))),row(1,1)),column(1,1,1))')
    expect(best.cost).toBeCloseTo(0.296_618_350_492_591_83, 12)
  })

  it.each([7, 8, 9])('should rank different arrangements of a page of %i photos', (count) => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { best, others } = searchPage(page(mixedAspects(count, seed)), seed)

      expect(new Set([best, ...others].map(({ signature }) => signature)).size).toBe(3)
    }
  })

  it('should give a photo that weighs more a larger share of the page', () => {
    const aspects = [LANDSCAPE, LANDSCAPE, LANDSCAPE, LANDSCAPE]
    const even = areas(searchPage(page(aspects), 2).best)
    const sut = areas(searchPage(page(aspects, [6, 1, 1, 1]), 2).best)

    expect(Math.max(...even) / Math.min(...even)).toBeLessThan(1.01)
    const [heavy, light] = sut

    expect(heavy).toBe(Math.max(...sut))
    expect(defined(heavy) / defined(light)).toBeGreaterThan(2)
  })

  it('should keep the photos of a full page large enough to see', () => {
    const { best } = searchPage(page(mixedAspects(9, 4)), 5)

    for (const area of areas(best)) {
      expect(area / areaOf(CONTENT)).toBeGreaterThan(0.03)
    }
  })

  it('should pair only the arrangements of a half that give each of its photos room', () => {
    const extremes = [0.7, 0.3, 20, 1.5, 0.3, 3, 1.5]
    const squares = extremes.map(() => SQUARE)

    expect(searchPage(page(extremes), 1).tried).toBeLessThan(searchPage(page(squares), 1).tried)
  })

  it('should give room to every photo of a page of panoramas and narrow photos', () => {
    const aspects = [PANORAMA, NARROW, NARROW, PANORAMA, PANORAMA, NARROW, NARROW, PANORAMA]
    const { best } = searchPage(page(aspects), 1)

    expect(Math.min(...areas(best))).toBeGreaterThan(EPSILON)
  })
})
