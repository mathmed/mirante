import { describe, expect, it } from 'vitest'

import { type DecodedPng, pixelOf, readPng } from '../../test/support/png.ts'
import { drawIcon } from './icon.ts'
import { encodePng } from './png.ts'

const AMBER = [0xf0, 0xb6, 0x5a, 255]
const LIGHT_AMBER = [0xff, 0xd0, 0x8a, 255]
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

  it('should draw the M of the mark in amber and its sun in the light amber', () => {
    const sut = icon(130)

    expect(at(sut, 0.385, 0.42)).toStrictEqual(AMBER)
    expect(at(sut, 0.5, 0.6)).toStrictEqual(AMBER)
    expect(at(sut, 0.625, 0.36)).toStrictEqual(AMBER)
    expect(at(sut, 0.25, 0.69)).toStrictEqual(AMBER)
    expect(at(sut, 0.75, 0.29)).toStrictEqual(LIGHT_AMBER)
  })

  it('should fill the square with a graphite gradient, lighter at the top left', () => {
    const sut = icon(130)

    expect(at(sut, 0.5, 0.15)).toStrictEqual([0x17, 0x17, 0x1b, 255])
    expect(at(sut, 0.15, 0.5)).toStrictEqual([0x17, 0x17, 0x1b, 255])
    expect(at(sut, 0.5, 0.9)).toStrictEqual([0x12, 0x12, 0x15, 255])
    expect(at(sut, 0.85, 0.85)).toStrictEqual([0x10, 0x10, 0x13, 255])
  })

  it('should leave the corners outside the rounded square transparent', () => {
    const sut = icon(80)

    expect(pixelOf(sut, 0, 0)).toStrictEqual(TRANSPARENT)
    expect(pixelOf(sut, 79, 79)).toStrictEqual(TRANSPARENT)
    expect(pixelOf(sut, 79, 40)[3]).toBe(255)
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
