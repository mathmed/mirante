import { describe, expect, it } from 'vitest'

import { pixelOf, readPng } from '../../test/support/png.ts'
import { encodePng } from './png.ts'

const RED = [255, 0, 0, 255]
const CLEAR_BLUE = [0, 0, 255, 128]

describe('encodePng', () => {
  it('should write a PNG of 8-bit RGBA pixels, row after row', () => {
    const pixels = new Uint8Array([...RED, ...CLEAR_BLUE, ...CLEAR_BLUE, ...RED, ...RED, ...RED])

    const sut = readPng(encodePng({ width: 3, height: 2, pixels }))

    expect(sut).toMatchObject({ width: 3, height: 2, bitDepth: 8, colorType: 6 })
    expect(sut.chunkTypes).toStrictEqual(['IHDR', 'IDAT', 'IEND'])
    expect([pixelOf(sut, 0, 0), pixelOf(sut, 1, 0), pixelOf(sut, 2, 0)]).toStrictEqual([
      RED,
      CLEAR_BLUE,
      CLEAR_BLUE,
    ])
    expect(pixelOf(sut, 0, 1)).toStrictEqual(RED)
  })

  it('should write the same bytes for the same pixels', () => {
    const image = { width: 1, height: 1, pixels: new Uint8Array(RED) }

    expect(encodePng(image)).toStrictEqual(encodePng(image))
  })

  it('should refuse pixels that do not fill the image', () => {
    expect(() => encodePng({ width: 2, height: 2, pixels: new Uint8Array(RED) })).toThrow(
      'expected 2x2 RGBA pixels',
    )
  })
})
