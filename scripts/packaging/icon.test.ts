import { describe, expect, it } from 'vitest'

import { type DecodedPng, pixelOf, readPng } from '../../test/support/png.ts'
import { drawIcon } from './icon.ts'
import { encodePng } from './png.ts'

const BACKGROUND = [0x0e, 0x0c, 0x09, 255]
const GOLD = [0xd4, 0xa9, 0x3c, 255]
const LIGHT_GOLD = [0xf0, 0xcf, 0x7a, 255]
const DARK_GOLD = [0x8a, 0x6a, 0x1f, 255]
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

  it('should draw the mark of the logo in its golds on the dark background of the app', () => {
    const sut = icon(130)

    expect(at(sut, 0.5, 0.265)).toStrictEqual(GOLD)
    expect(at(sut, 0.62, 0.48)).toStrictEqual(LIGHT_GOLD)
    expect(at(sut, 0.15, 0.615)).toStrictEqual(GOLD)
    expect(at(sut, 0.5, 0.775)).toStrictEqual(DARK_GOLD)
    expect(at(sut, 0.5, 0.33)).toStrictEqual(BACKGROUND)
    expect(at(sut, 0.5, 0.9)).toStrictEqual(BACKGROUND)
  })

  it('should leave the corners outside the rounded square transparent', () => {
    const sut = icon(80)

    expect(pixelOf(sut, 0, 0)).toStrictEqual(TRANSPARENT)
    expect(pixelOf(sut, 79, 79)).toStrictEqual(TRANSPARENT)
    expect(pixelOf(sut, 79, 30)).toStrictEqual(BACKGROUND)
  })

  it('should smooth the edges with pixels partly covered', () => {
    const sut = icon(80)
    const alphas = new Set([
      ...[...new Array<undefined>(80).keys()].map((x) => pixelOf(sut, x, 2)[3]),
    ])

    expect([...alphas].some((alpha) => alpha !== undefined && alpha > 0 && alpha < 255)).toBe(true)
  })

  it('should draw the same pixels every time', () => {
    const sut = drawIcon(130)

    expect(Buffer.from(sut.pixels).equals(Buffer.from(drawIcon(130).pixels))).toBe(true)
  })
})
