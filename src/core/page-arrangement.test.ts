import { describe, expect, it } from 'vitest'

import { defined, EPSILON, isApart, isInside, mixedAspects } from '../../test/book-photos.ts'
import { areaOf } from './book-geometry.ts'
import { zipWith } from './lists.ts'
import {
  areasOf,
  type Arrangement,
  arrangementsOf,
  Cut,
  isLeaf,
  leafOf,
  placementsOf,
  signatureOf,
  splitOf,
} from './page-arrangement.ts'

const GAP = 0.1

function aspectsOf(arrangement: Arrangement): readonly number[] {
  return isLeaf(arrangement) ? [arrangement.aspect] : arrangement.parts.flatMap(aspectsOf)
}

// The box of an arrangement of its own shape, at this width.
function boxAt(
  arrangement: Arrangement,
  width: number,
): { x: number; y: number; width: number; height: number } {
  const { slope, offset } = arrangement.shape
  return { x: 0.5, y: 0.25, width, height: slope * width + offset }
}

describe('arrangementsOf', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 6],
    [4, 22],
    [5, 90],
    [6, 394],
  ])('should find every arrangement of %i photos: %i', (count, arrangements) => {
    const sut = arrangementsOf(mixedAspects(count), GAP)

    expect(sut).toHaveLength(arrangements)
    expect(new Set(sut.map(signatureOf)).size).toBe(arrangements)
  })

  it('should keep every photo once, in its order', () => {
    const aspects = [1, 2, 3, 4, 5]

    for (const arrangement of arrangementsOf(aspects, GAP)) {
      expect(aspectsOf(arrangement)).toStrictEqual(aspects)
    }
  })

  it('should share the parts the arrangements have in common', () => {
    const sut = arrangementsOf(mixedAspects(5), GAP).filter(
      (arrangement) => !isLeaf(arrangement) && arrangement.cut === Cut.Row,
    )
    const firstParts = sut.map((arrangement) =>
      isLeaf(arrangement) ? arrangement : arrangement.parts[0],
    )
    const shared = firstParts.filter(
      (part, index) => part !== undefined && !isLeaf(part) && firstParts.indexOf(part) !== index,
    )

    expect(shared.length).toBeGreaterThan(0)
  })

  it('should alternate the cuts: no row in a row, no column in a column', () => {
    const isAlternating = (arrangement: Arrangement): boolean =>
      isLeaf(arrangement) ||
      arrangement.parts.every(
        (part) => (isLeaf(part) || part.cut !== arrangement.cut) && isAlternating(part),
      )

    expect(arrangementsOf(mixedAspects(5), GAP).every(isAlternating)).toBe(true)
  })

  it('should cut three photos in six ways', () => {
    expect(arrangementsOf([1, 1, 1], GAP).map(signatureOf)).toStrictEqual([
      'row(1,column(1,1))',
      'row(1,1,1)',
      'row(column(1,1),1)',
      'column(1,row(1,1))',
      'column(1,1,1)',
      'column(row(1,1),1)',
    ])
  })
})

describe('signatureOf', () => {
  it('should read a photo as 1', () => {
    expect(signatureOf(leafOf(2))).toBe('1')
  })
})

describe('splitOf', () => {
  it('should make a row of photos as high as their width less the gaps over their aspects', () => {
    const sut = splitOf(Cut.Row, [leafOf(2), leafOf(1)], GAP)

    // 2h + 1h + 0.1 = w
    expect(sut.shape.slope).toBeCloseTo(1 / 3, 12)
    expect(sut.shape.offset).toBeCloseTo(-0.1 / 3, 12)
  })

  it('should make a column of photos as high as their heights and the gaps', () => {
    const sut = splitOf(Cut.Column, [leafOf(2), leafOf(1), leafOf(4)], GAP)

    expect(sut.shape.slope).toBeCloseTo(0.5 + 1 + 0.25, 12)
    expect(sut.shape.offset).toBeCloseTo(0.2, 12)
  })

  it('should carry the gaps of its parts', () => {
    const column = splitOf(Cut.Column, [leafOf(1), leafOf(1)], GAP)
    const sut = splitOf(Cut.Row, [column, leafOf(1)], GAP)

    // The column is w1 wide and 2 w1 + 0.1 high; the photo is as high: h = 2 w1 + 0.1 = w2.
    // w = w1 + w2 + 0.1 = (h - 0.1) / 2 + h + 0.1, so h = (2 w - 0.1) / 3.
    expect(sut.shape.slope).toBeCloseTo(2 / 3, 12)
    expect(sut.shape.offset).toBeCloseTo(-0.1 / 3, 12)
  })
})

describe('placementsOf', () => {
  it('should fill a box of the arrangement shape, each photo its own box, whole', () => {
    for (const arrangement of arrangementsOf(mixedAspects(5), GAP)) {
      const box = boxAt(arrangement, 2)
      const sut = placementsOf(arrangement, box, GAP)

      sut.forEach(({ cell, photo }) => {
        expect(isInside(cell, box)).toBe(true)
        expect(photo.x).toBeCloseTo(cell.x, 9)
        expect(photo.y).toBeCloseTo(cell.y, 9)
        expect(photo.width).toBeCloseTo(cell.width, 9)
        expect(photo.height).toBeCloseTo(cell.height, 9)
      })
    }
  })

  it('should keep the shape of each photo, never stretched', () => {
    const aspects = mixedAspects(6)
    for (const arrangement of arrangementsOf(aspects, GAP)) {
      const sut = placementsOf(arrangement, boxAt(arrangement, 3), GAP)

      zipWith(sut, aspects, ({ photo }, aspect) => {
        expect(photo.width / photo.height).toBeCloseTo(aspect, 9)
      })
    }
  })

  it('should keep the gap between any two photos', () => {
    for (const arrangement of arrangementsOf(mixedAspects(5, 3), GAP)) {
      const cells = placementsOf(arrangement, boxAt(arrangement, 4), GAP).map(({ cell }) => cell)

      cells.forEach((cell, index) => {
        cells.slice(index + 1).forEach((other) => {
          expect(isApart(cell, other, GAP)).toBe(true)
        })
      })
    }
  })

  it('should place a row from left to right and a column from top to bottom', () => {
    const row = splitOf(Cut.Row, [leafOf(1), leafOf(2)], GAP)
    const [left, right] = placementsOf(row, { x: 0, y: 0, width: 3.1, height: 1 }, GAP)
    const column = splitOf(Cut.Column, [leafOf(1), leafOf(0.5)], GAP)
    const [top, bottom] = placementsOf(column, { x: 0, y: 0, width: 1, height: 3.1 }, GAP)

    expect(defined(left).cell).toStrictEqual({ x: 0, y: 0, width: 1, height: 1 })
    expect(defined(right).cell.x).toBeCloseTo(1.1, 12)
    expect(defined(right).cell.width).toBeCloseTo(2, 12)
    expect(defined(top).cell).toStrictEqual({ x: 0, y: 0, width: 1, height: 1 })
    expect(defined(bottom).cell.y).toBeCloseTo(1.1, 12)
    expect(defined(bottom).cell.height).toBeCloseTo(2, 12)
  })
})

describe('areasOf', () => {
  it('should measure what the placements give', () => {
    for (const arrangement of arrangementsOf(mixedAspects(5, 7), GAP)) {
      const box = boxAt(arrangement, 2.5)
      const sut = areasOf(arrangement, box)
      const placed = placementsOf(arrangement, box, GAP).map(({ photo }) => areaOf(photo))

      expect(sut).toHaveLength(placed.length)
      zipWith(sut, placed, (area, placedArea) => {
        expect(area).toBeCloseTo(placedArea, 9)
      })
    }
  })

  it('should give no room to a photo whose box has none', () => {
    const column = splitOf(Cut.Column, [leafOf(1), leafOf(1)], GAP)
    const sut = splitOf(Cut.Row, [column, leafOf(50)], GAP)

    // So wide that the row is lower than the gap of the column.
    const [first, second, third] = areasOf(sut, {
      width: 1,
      height: sut.shape.slope + sut.shape.offset,
    })

    expect(first).toBe(0)
    expect(second).toBe(0)
    expect(third).toBeGreaterThan(EPSILON)
  })
})
