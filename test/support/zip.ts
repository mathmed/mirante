// Reads the .wgt files the Tizen packaging writes (zip archives of deflated files, without zip64 or
// a comment), checking every header and checksum, so that the tests compare files rather than
// bytes. The end-to-end test unpacks the package with it too.
import { crc32, inflateRawSync } from 'node:zlib'

import { expect } from 'vitest'

const LOCAL_SIGNATURE = 0x04034b50
const CENTRAL_SIGNATURE = 0x02014b50
const END_SIGNATURE = 0x06054b50
const END_BYTES = 22
const CENTRAL_BYTES = 46
const LOCAL_BYTES = 30
const DEFLATE = 8

export interface ZipFile {
  readonly path: string
  readonly content: Uint8Array
  // What the central directory says of the file.
  readonly method: number
  readonly flags: number
  readonly time: number
  readonly date: number
  readonly mode: number
}

export function readZip(bytes: Uint8Array): ZipFile[] {
  const zip = Buffer.from(bytes)
  const end = zip.length - END_BYTES
  expect(zip.readUInt32LE(end)).toBe(END_SIGNATURE)
  const count = zip.readUInt16LE(end + 10)
  expect(zip.readUInt16LE(end + 8)).toBe(count)
  const directoryOffset = zip.readUInt32LE(end + 16)
  expect(directoryOffset + zip.readUInt32LE(end + 12)).toBe(end)
  expect(zip.readUInt16LE(end + 20)).toBe(0)
  const files: ZipFile[] = []
  let offset = directoryOffset
  for (let index = 0; index < count; index += 1) {
    const file = centralEntry(zip, offset)
    files.push(file.file)
    offset = file.next
  }
  expect(offset).toBe(end)
  return files
}

function centralEntry(zip: Buffer, offset: number): { file: ZipFile; next: number } {
  expect(zip.readUInt32LE(offset)).toBe(CENTRAL_SIGNATURE)
  const nameLength = zip.readUInt16LE(offset + 28)
  const extraLength = zip.readUInt16LE(offset + 30)
  const commentLength = zip.readUInt16LE(offset + 32)
  const path = zip.toString('utf8', offset + CENTRAL_BYTES, offset + CENTRAL_BYTES + nameLength)
  const method = zip.readUInt16LE(offset + 10)
  const compressedSize = zip.readUInt32LE(offset + 20)
  const content = localContent(zip, zip.readUInt32LE(offset + 42), { path, method, compressedSize })
  expect(content).toHaveLength(zip.readUInt32LE(offset + 24))
  expect(crc32(content)).toBe(zip.readUInt32LE(offset + 16))
  return {
    file: {
      path,
      content,
      method,
      flags: zip.readUInt16LE(offset + 8),
      time: zip.readUInt16LE(offset + 12),
      date: zip.readUInt16LE(offset + 14),
      mode: zip.readUInt32LE(offset + 38) >>> 16,
    },
    next: offset + CENTRAL_BYTES + nameLength + extraLength + commentLength,
  }
}

function localContent(
  zip: Buffer,
  offset: number,
  central: { path: string; method: number; compressedSize: number },
): Uint8Array {
  expect(zip.readUInt32LE(offset)).toBe(LOCAL_SIGNATURE)
  const nameLength = zip.readUInt16LE(offset + 26)
  const start = offset + LOCAL_BYTES + nameLength + zip.readUInt16LE(offset + 28)
  expect(zip.toString('utf8', offset + LOCAL_BYTES, offset + LOCAL_BYTES + nameLength)).toBe(
    central.path,
  )
  expect(zip.readUInt32LE(offset + 18)).toBe(central.compressedSize)
  const data = zip.subarray(start, start + central.compressedSize)
  return new Uint8Array(central.method === DEFLATE ? inflateRawSync(data) : data)
}
