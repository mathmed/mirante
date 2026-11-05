import { describe, expect, it } from 'vitest'

import { boundsOf, hexOf, isInShape, type Shape, ShapeKind, svgPathOf } from './shapes.ts'

const COLOR = { red: 0xd4, green: 0xa9, blue: 0x3c }

const TRIANGLE: Shape = {
  kind: ShapeKind.Polygon,
  points: [
    { x: 0.1, y: 0.9 },
    { x: 0.5, y: 0.1 },
    { x: 0.9, y: 0.9 },
  ],
  color: COLOR,
}

const BAR: Shape = { kind: ShapeKind.Bar, y: 0.5, left: 0.2, right: 0.8, radius: 0.1, color: COLOR }

const ARCH: Shape = {
  kind: ShapeKind.Arch,
  center: { x: 0.5, y: 0.6 },
  outerRadius: 0.4,
  innerRadius: 0.3,
  color: COLOR,
}

describe('isInShape', () => {
  it.each([
    [0.5, 0.5, true],
    [0.5, 0.89, true],
    [0.2, 0.3, false],
    [0.5, 0.95, false],
  ])('should tell whether (%f, %f) is inside a polygon: %s', (x, y, isInside) => {
    expect(isInShape(TRIANGLE, { x, y })).toBe(isInside)
  })

  it.each([
    [0.5, 0.45, true],
    [0.15, 0.5, true],
    [0.85, 0.55, true],
    [0.5, 0.39, false],
    [0.12, 0.42, false],
    [0.95, 0.5, false],
  ])('should tell whether (%f, %f) is inside a bar with round ends: %s', (x, y, isInside) => {
    expect(isInShape(BAR, { x, y })).toBe(isInside)
  })

  it.each([
    [0.5, 0.25, true],
    [0.15, 0.6, true],
    [0.85, 0.59, true],
    [0.5, 0.21, true],
    [0.5, 0.19, false],
    [0.5, 0.4, false],
    [0.15, 0.62, false],
  ])('should tell whether (%f, %f) is inside the upper half of a ring: %s', (x, y, isInside) => {
    expect(isInShape(ARCH, { x, y })).toBe(isInside)
  })
})

describe('svgPathOf', () => {
  it('should draw a polygon with straight lines, closed', () => {
    expect(svgPathOf(TRIANGLE, 1000)).toBe('M100 900L500 100L900 900Z')
  })

  it('should draw a bar as two straight sides and two half circles', () => {
    expect(svgPathOf(BAR, 1000)).toBe(
      'M200 400H800A100 100 0 0 1 800 600H200A100 100 0 0 1 200 400Z',
    )
  })

  it('should draw the arch over the top along its outer circle and back along its inner one', () => {
    expect(svgPathOf(ARCH, 1000)).toBe('M100 600A400 400 0 0 1 900 600H800A300 300 0 0 0 200 600Z')
  })

  it('should keep one decimal of the scaled coordinates', () => {
    const sut = svgPathOf({ ...TRIANGLE, points: [{ x: 0.12345, y: 0.5 }] }, 1000)

    expect(sut).toBe('M123.5 500Z')
  })
})

describe('boundsOf', () => {
  it('should give the box around one shape', () => {
    expect(boundsOf([BAR])).toStrictEqual({ left: 0.1, top: 0.4, right: 0.9, bottom: 0.6 })
  })

  it('should give the box around every shape, an arch ending on its center line', () => {
    const sut = boundsOf([ARCH, TRIANGLE])

    expect(sut.left).toBeCloseTo(0.1)
    expect(sut.top).toBeCloseTo(0.1)
    expect(sut.right).toBeCloseTo(0.9)
    expect(sut.bottom).toBeCloseTo(0.9)
    expect(boundsOf([ARCH]).bottom).toBeCloseTo(0.6)
  })
})

describe('hexOf', () => {
  it('should write the color in uppercase hexadecimal, two digits a channel', () => {
    expect(hexOf({ red: 0x0e, green: 0x0c, blue: 0x9 })).toBe('#0E0C09')
    expect(hexOf(COLOR)).toBe('#D4A93C')
  })
})
