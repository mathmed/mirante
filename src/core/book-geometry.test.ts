import { describe, expect, it } from 'vitest'

import {
  areaOf,
  CONTENT,
  fitInside,
  GAP,
  MARGIN,
  normalized,
  PAGE_ASPECT,
} from './book-geometry.ts'

describe('the page', () => {
  it('should be 4:3, with a margin of 6% of its width and a gap of 2%', () => {
    expect(PAGE_ASPECT).toBeCloseTo(4 / 3, 12)
    expect(MARGIN / PAGE_ASPECT).toBeCloseTo(0.06, 12)
    expect(GAP / PAGE_ASPECT).toBeCloseTo(0.02, 12)
  })

  it('should keep the photos inside its margins', () => {
    expect(CONTENT).toStrictEqual({
      x: MARGIN,
      y: MARGIN,
      width: PAGE_ASPECT - 2 * MARGIN,
      height: 1 - 2 * MARGIN,
    })
  })
})

describe('fitInside', () => {
  const BOX = { x: 1, y: 2, width: 4, height: 2 }

  it('should fit a wide photo to the width of the box, in its middle', () => {
    expect(fitInside(4, BOX)).toStrictEqual({ x: 1, y: 2.5, width: 4, height: 1 })
  })

  it('should fit a tall photo to the height of the box, in its middle', () => {
    expect(fitInside(1, BOX)).toStrictEqual({ x: 2, y: 2, width: 2, height: 2 })
  })

  it('should fill a box of its own shape', () => {
    expect(fitInside(2, BOX)).toStrictEqual(BOX)
  })
})

describe('areaOf', () => {
  it('should multiply the width by the height', () => {
    expect(areaOf({ x: 9, y: 9, width: 3, height: 5 })).toBe(15)
  })
})

describe('normalized', () => {
  it('should give the box in fractions of the width and the height of the page', () => {
    const sut = normalized({ x: PAGE_ASPECT / 4, y: 0.5, width: PAGE_ASPECT / 2, height: 0.25 })

    expect(sut.x).toBeCloseTo(0.25, 12)
    expect(sut.y).toBe(0.5)
    expect(sut.width).toBeCloseTo(0.5, 12)
    expect(sut.height).toBe(0.25)
  })
})
