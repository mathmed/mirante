import { describe, expect, it } from 'vitest'

import { type DecodedPng, pixelOf, readPng } from '../../test/support/png.ts'
import { drawIcon } from './icon.ts'
import { encodePng } from './png.ts'

const BACKGROUND = [0x10, 0x14, 0x18, 255]
const LETTER = [0xff, 0xd1, 0x66, 255]
const TRANSPARENT = [0, 0, 0, 0]

function icon(size: number): DecodedPng {
  return readPng(encodePng(drawIcon(size)))
}

// The pixel at a point of the square of side 1 the icon is drawn on.
function at(png: DecodedPng, x: number, y: number): number[] {
  return pixelOf(png, Math.floor(x * png.width), Math.floor(y * png.height))
}

describe('drawIcon', () => {
  it.each([80, 130])('should draw a square icon of %i pixels', (size) => {
    const sut = icon(size)

    expect([sut.width, sut.height]).toStrictEqual([size, size])
  })

  it('should draw the M in the yellow of the focus ring on the dark background of the app', () => {
    const sut = icon(130)

    expect(at(sut, 0.28, 0.6)).toStrictEqual(LETTER)
    expect(at(sut, 0.72, 0.3)).toStrictEqual(LETTER)
    expect(at(sut, 0.5, 0.55)).toStrictEqual(LETTER)
    expect(at(sut, 0.5, 0.35)).toStrictEqual(BACKGROUND)
    expect(at(sut, 0.5, 0.75)).toStrictEqual(BACKGROUND)
    expect(at(sut, 0.1, 0.5)).toStrictEqual(BACKGROUND)
  })

  it('should leave the corners outside the rounded square transparent', () => {
    const sut = icon(80)

    expect(pixelOf(sut, 0, 0)).toStrictEqual(TRANSPARENT)
    expect(pixelOf(sut, 79, 79)).toStrictEqual(TRANSPARENT)
    expect(pixelOf(sut, 79, 40)).toStrictEqual(BACKGROUND)
  })

  it('should smooth the edges with pixels partly covered', () => {
    const sut = icon(80)
    const alphas = new Set([
      ...[...new Array<undefined>(80).keys()].map((x) => pixelOf(sut, x, 2)[3]),
    ])

    expect([...alphas].some((alpha) => alpha !== undefined && alpha > 0 && alpha < 255)).toBe(true)
  })

  it('should draw the same pixels every time', () => {
    expect(drawIcon(130)).toStrictEqual(drawIcon(130))
  })
})
