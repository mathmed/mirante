// Reads the PNGs the packaging writes (8-bit RGBA, rows without a filter), checking every chunk,
// so that the tests compare pixels rather than bytes.
import { crc32, inflateSync } from 'node:zlib'

import { expect } from 'vitest'

const SIGNATURE = '\x89PNG\r\n\x1a\n'
const RGBA_BYTES = 4

export interface DecodedPng {
  readonly width: number
  readonly height: number
  readonly bitDepth: number
  readonly colorType: number
  readonly chunkTypes: readonly string[]
  readonly pixels: Uint8Array
}

export function readPng(bytes: Uint8Array): DecodedPng {
  const buffer = Buffer.from(bytes)
  expect(buffer.subarray(0, 8).toString('latin1')).toBe(SIGNATURE)
  const chunks = chunksOf(buffer)
  const header = chunks.get('IHDR') ?? Buffer.alloc(0)
  const width = header.readUInt32BE(0)
  const height = header.readUInt32BE(4)
  return {
    width,
    height,
    bitDepth: header.readUInt8(8),
    colorType: header.readUInt8(9),
    chunkTypes: [...chunks.keys()],
    pixels: unfiltered(inflateSync(chunks.get('IDAT') ?? Buffer.alloc(0)), width, height),
  }
}

// The color of a pixel: red, green, blue and alpha.
export function pixelOf(png: DecodedPng, x: number, y: number): number[] {
  const start = (y * png.width + x) * RGBA_BYTES
  return [...png.pixels.subarray(start, start + RGBA_BYTES)]
}

function chunksOf(buffer: Buffer): Map<string, Buffer> {
  const chunks = new Map<string, Buffer>()
  let offset = 8
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const typeAndData = buffer.subarray(offset + 4, offset + 8 + length)
    expect(buffer.readUInt32BE(offset + 8 + length)).toBe(crc32(typeAndData))
    chunks.set(typeAndData.subarray(0, 4).toString('latin1'), typeAndData.subarray(4))
    offset += 12 + length
  }
  return chunks
}

function unfiltered(data: Buffer, width: number, height: number): Uint8Array {
  const rowBytes = width * RGBA_BYTES
  const pixels = new Uint8Array(rowBytes * height)
  for (let row = 0; row < height; row += 1) {
    const start = row * (rowBytes + 1)
    expect(data.readUInt8(start)).toBe(0)
    pixels.set(data.subarray(start + 1, start + 1 + rowBytes), row * rowBytes)
  }
  expect(data).toHaveLength(height * (rowBytes + 1))
  return pixels
}
