import { describe, expect, it } from 'vitest'

import {
  arcPoints,
  boundsOf,
  hexOf,
  isInShape,
  mixOf,
  type Shape,
  ShapeKind,
  svgElementOf,
} from './shapes.ts'

const COLOR = { red: 0xf0, green: 0xb6, blue: 0x5a }

// A V: down from the top left, up to the top right.
const STROKE: Shape = {
  kind: ShapeKind.Stroke,
  points: [
    { x: 0.2, y: 0.2 },
    { x: 0.5, y: 0.8 },
    { x: 0.8, y: 0.2 },
  ],
  radius: 0.05,
  color: COLOR,
}

const DOT: Shape = {
  kind: ShapeKind.Stroke,
  points: [{ x: 0.5, y: 0.5 }],
  radius: 0.1,
  color: COLOR,
}

const DISK: Shape = { kind: ShapeKind.Disk, center: { x: 0.6, y: 0.4 }, radius: 0.1, color: COLOR }

describe('isInShape', () => {
  it.each([
    [0.35, 0.5, true],
    [0.65, 0.5, true],
    [0.5, 0.84, true],
    [0.2, 0.16, true],
    [0.5, 0.5, false],
    [0.5, 0.86, false],
    [0.2, 0.14, false],
    [0.1, 0.2, false],
  ])('should tell whether (%f, %f) is within the width of a stroke: %s', (x, y, isInside) => {
    expect(isInShape(STROKE, { x, y })).toBe(isInside)
  })

  it.each([
    [0.5, 0.59, true],
    [0.59, 0.5, true],
    [0.5, 0.61, false],
  ])('should draw a stroke of one point as a dot: (%f, %f) %s', (x, y, isInside) => {
    expect(isInShape(DOT, { x, y })).toBe(isInside)
  })

  it.each([
    [0.6, 0.4, true],
    [0.69, 0.4, true],
    [0.6, 0.31, true],
    [0.71, 0.4, false],
    [0.68, 0.48, false],
  ])('should tell whether (%f, %f) is inside a disk: %s', (x, y, isInside) => {
    expect(isInShape(DISK, { x, y })).toBe(isInside)
  })
})

describe('svgElementOf', () => {
  it('should draw a stroke as a path with round ends and corners', () => {
    expect(svgElementOf(STROKE, 1000)).toBe(
      '<path d="M200 200L500 800L800 200" fill="none" stroke="#F0B65A" stroke-width="100" stroke-linecap="round" stroke-linejoin="round"/>',
    )
  })

  it('should draw a disk as a circle', () => {
    expect(svgElementOf(DISK, 1000)).toBe('<circle cx="600" cy="400" r="100" fill="#F0B65A"/>')
  })

  it('should keep one decimal of the scaled coordinates', () => {
    const sut = svgElementOf({ ...DISK, center: { x: 0.12345, y: 0.5 } }, 1000)

    expect(sut).toBe('<circle cx="123.5" cy="500" r="100" fill="#F0B65A"/>')
  })
})

describe('boundsOf', () => {
  it('should give the box around one stroke, its width included', () => {
    const sut = boundsOf([STROKE])

    expect(sut.left).toBeCloseTo(0.15)
    expect(sut.top).toBeCloseTo(0.15)
    expect(sut.right).toBeCloseTo(0.85)
    expect(sut.bottom).toBeCloseTo(0.85)
  })

  it('should give the box around every shape', () => {
    const sut = boundsOf([DISK, { ...DOT, points: [{ x: 0.2, y: 0.9 }] }])

    expect(sut.left).toBeCloseTo(0.1)
    expect(sut.top).toBeCloseTo(0.3)
    expect(sut.right).toBeCloseTo(0.7)
    expect(sut.bottom).toBeCloseTo(1)
  })
})

describe('hexOf', () => {
  it('should write the color in uppercase hexadecimal, two digits a channel', () => {
    expect(hexOf({ red: 0x0c, green: 0x0c, blue: 0xe })).toBe('#0C0C0E')
    expect(hexOf(COLOR)).toBe('#F0B65A')
  })
})

describe('mixOf', () => {
  const FROM = { red: 0, green: 100, blue: 200 }
  const TO = { red: 100, green: 100, blue: 0 }

  it.each([
    [0, FROM],
    [1, TO],
    [0.25, { red: 25, green: 100, blue: 150 }],
    [0.333, { red: 33, green: 100, blue: 133 }],
  ])('should give the color a share %f of the way, each channel rounded', (share, color) => {
    expect(mixOf(FROM, TO, share)).toStrictEqual(color)
  })
})

describe('arcPoints', () => {
  it('should go along the circle from the first angle to the last, counterclockwise from the right', () => {
    const sut = arcPoints({
      center: { x: 0.5, y: 0.5 },
      radius: 0.2,
      fromDegrees: 180,
      toDegrees: 0,
      steps: 2,
    })

    expect(sut).toHaveLength(3)
    expect(sut[0].x).toBeCloseTo(0.3)
    expect(sut[0].y).toBeCloseTo(0.5)
    expect(sut[1]?.x).toBeCloseTo(0.5)
    expect(sut[1]?.y).toBeCloseTo(0.3)
    expect(sut[2]?.x).toBeCloseTo(0.7)
    expect(sut[2]?.y).toBeCloseTo(0.5)
  })
})
