import { crc32, deflateSync } from 'node:zlib'

// A PNG of 8-bit RGBA pixels (color type 6), with no filter on its rows: small and plain enough to
// write by hand, so that the icons need no image library.
const SIGNATURE = Buffer.from('\x89PNG\r\n\x1a\n', 'latin1')
const BIT_DEPTH = 8
const RGBA_COLOR_TYPE = 6
const NO_FILTER = 0
const LENGTH_BYTES = 4
const TYPE_BYTES = 4
const CRC_BYTES = 4
// The header: width, height, bit depth, color type, then the compression, filter and interlace
// methods, left at 0 (the only ones PNG defines, and no interlacing).
const HEADER_BYTES = 13
const HEIGHT_OFFSET = 4
const BIT_DEPTH_OFFSET = 8
const COLOR_TYPE_OFFSET = 9
const BEST_COMPRESSION = 9
export const BYTES_PER_PIXEL = 4

export interface Image {
  readonly width: number
  readonly height: number
  // Row after row, four bytes per pixel: red, green, blue and alpha.
  readonly pixels: Uint8Array
}

export function encodePng(image: Image): Uint8Array {
  if (image.pixels.length !== image.width * image.height * BYTES_PER_PIXEL) {
    throw new RangeError(`expected ${String(image.width)}x${String(image.height)} RGBA pixels`)
  }
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header(image)),
    chunk('IDAT', deflateSync(rows(image), { level: BEST_COMPRESSION })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function header({ width, height }: Image): Buffer {
  const data = Buffer.alloc(HEADER_BYTES)
  data.writeUInt32BE(width, 0)
  data.writeUInt32BE(height, HEIGHT_OFFSET)
  data.writeUInt8(BIT_DEPTH, BIT_DEPTH_OFFSET)
  data.writeUInt8(RGBA_COLOR_TYPE, COLOR_TYPE_OFFSET)
  return data
}

// Each row starts with the byte of its filter.
function rows({ width, height, pixels }: Image): Buffer {
  const rowBytes = width * BYTES_PER_PIXEL
  const data = Buffer.alloc(height * (rowBytes + 1))
  for (let row = 0; row < height; row += 1) {
    const start = row * (rowBytes + 1)
    data.writeUInt8(NO_FILTER, start)
    data.set(pixels.subarray(row * rowBytes, (row + 1) * rowBytes), start + 1)
  }
  return data
}

function chunk(type: string, data: Uint8Array): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const result = Buffer.alloc(LENGTH_BYTES + typeAndData.length + CRC_BYTES)
  result.writeUInt32BE(data.length, 0)
  result.set(typeAndData, LENGTH_BYTES)
  result.writeUInt32BE(crc32(typeAndData), LENGTH_BYTES + TYPE_BYTES + data.length)
  return result
}
