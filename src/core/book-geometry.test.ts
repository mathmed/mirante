import { describe, expect, it } from 'vitest'

import {
  areaOf,
  BookFormat,
  fitInside,
  normalized,
  pageAspectOf,
  pageGeometry,
} from './book-geometry.ts'

describe('pageAspectOf', () => {
  it('should make a full screen page 8:9, two of them a 16:9 spread', () => {
    expect(pageAspectOf(BookFormat.Wide)).toBeCloseTo(8 / 9, 12)
    expect(2 * pageAspectOf(BookFormat.Wide)).toBeCloseTo(16 / 9, 12)
  })

  it('should keep the classic page 4:3, the shape the book had first', () => {
    expect(pageAspectOf(BookFormat.Classic)).toBeCloseTo(4 / 3, 12)
  })

  it('should refuse a format it does not know', () => {
    expect(() => pageAspectOf('round' as BookFormat)).toThrow(RangeError)
  })
})

describe('pageGeometry', () => {
  it.each([8 / 9, 4 / 3, 1])(
    'should give a page of aspect %d a margin of 4%% of its width and a gap of 1.5%%',
    (aspect) => {
      const sut = pageGeometry(aspect)

      expect(sut.aspect).toBe(aspect)
      expect(sut.margin / aspect).toBeCloseTo(0.04, 12)
      expect(sut.gap / aspect).toBeCloseTo(0.015, 12)
    },
  )

  it('should keep the photos inside the margins of the page, in page heights', () => {
    const sut = pageGeometry(8 / 9)

    expect(sut.content).toStrictEqual({
      x: sut.margin,
      y: sut.margin,
      width: 8 / 9 - 2 * sut.margin,
      height: 1 - 2 * sut.margin,
    })
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'should refuse a page of aspect %d',
    (aspect) => {
      expect(() => pageGeometry(aspect)).toThrow(RangeError)
    },
  )

  it('should take a page of any positive aspect', () => {
    expect(pageGeometry(Number.MIN_VALUE).aspect).toBe(Number.MIN_VALUE)
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
  it.each([8 / 9, 4 / 3, 1])(
    'should give the box in fractions of the width and the height of a page of aspect %d',
    (aspect) => {
      const sut = normalized({ x: aspect / 4, y: 0.5, width: aspect / 2, height: 0.25 }, aspect)

      expect(sut.x).toBeCloseTo(0.25, 12)
      expect(sut.y).toBe(0.5)
      expect(sut.width).toBeCloseTo(0.5, 12)
      expect(sut.height).toBe(0.25)
    },
  )
})
