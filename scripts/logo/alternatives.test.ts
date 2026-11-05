import { describe, expect, it } from 'vitest'

import { FRAME_MARK, MONOGRAM_MARK } from './alternatives.ts'
import { PALETTE } from './mark.ts'
import { boundsOf, isInShape } from './shapes.ts'

describe('MONOGRAM_MARK', () => {
  it('should draw the arc of the lens, open below, in the dark amber', () => {
    const [lens] = MONOGRAM_MARK

    expect(lens.color).toStrictEqual(PALETTE.darkAmber)
    expect(isInShape(lens, { x: 0.5, y: 0.22 })).toBe(true)
    expect(isInShape(lens, { x: 0.2, y: 0.52 })).toBe(true)
    expect(isInShape(lens, { x: 0.5, y: 0.82 })).toBe(false)
  })

  it('should draw the m with three stems and two arches, in amber', () => {
    const [, ...letter] = MONOGRAM_MARK
    const isInLetter = (x: number, y: number): boolean =>
      letter.some((shape) => isInShape(shape, { x, y }))

    expect(letter.map((shape) => shape.color)).toStrictEqual([PALETTE.amber, PALETTE.amber])
    expect([0.335, 0.5, 0.665].map((x) => isInLetter(x, 0.6))).toStrictEqual([true, true, true])
    expect([0.4175, 0.5825].map((x) => isInLetter(x, 0.3875))).toStrictEqual([true, true])
    expect(isInLetter(0.4175, 0.6)).toBe(false)
    expect(isInLetter(0.5825, 0.6)).toBe(false)
  })

  it('should keep inside the icon, with a margin', () => {
    const sut = boundsOf(MONOGRAM_MARK)

    expect(sut.left).toBeGreaterThan(0.15)
    expect(sut.right).toBeLessThan(0.85)
    expect(sut.top).toBeGreaterThan(0.15)
    expect(sut.bottom).toBeLessThan(0.85)
  })
})

describe('FRAME_MARK', () => {
  it('should draw the four corners of the frame and nothing between them', () => {
    const corners = FRAME_MARK.slice(0, 4)
    const isInCorners = (x: number, y: number): boolean =>
      corners.some((shape) => isInShape(shape, { x, y }))

    expect(
      [
        [0.26, 0.28],
        [0.74, 0.28],
        [0.26, 0.72],
        [0.74, 0.72],
      ].map(([x = 0, y = 0]) => isInCorners(x, y)),
    ).toStrictEqual([true, true, true, true])
    expect(isInCorners(0.5, 0.28)).toBe(false)
    expect(isInCorners(0.26, 0.5)).toBe(false)
  })

  it('should put the dot on a third of the frame, in the light amber', () => {
    const dot = FRAME_MARK[4]

    expect(dot?.color).toStrictEqual(PALETTE.lightAmber)
    expect(dot !== undefined && isInShape(dot, { x: 0.58, y: 0.44 })).toBe(true)
  })
})
