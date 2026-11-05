import { crc32, deflateRawSync } from 'node:zlib'

// A .wgt is a zip archive. This writes the plain kind every unzip reads: each file deflated, a
// central directory, no zip64 (the app is far below its 4 GB and 65535 files) and no signature,
// which the Tizen CLI adds with the owner's certificates. Every field is fixed but the files, so
// the same files always give the same bytes.
const LOCAL_SIGNATURE = 0x04_03_4b_50
const CENTRAL_SIGNATURE = 0x02_01_4b_50
const END_SIGNATURE = 0x06_05_4b_50
// Version 2.0 of the format, the first with deflate, written by a Unix system (3).
const VERSION_NEEDED = 20
const MADE_BY_UNIX = 0x03_14
// Bit 11: the names are UTF-8.
const UTF8_NAMES = 0x08_00
const DEFLATE = 8
// 1980-01-01 00:00, the earliest date zip can write.
const DOS_DATE = 0x00_21
const DOS_TIME = 0
// A regular file readable by everyone, in the high half of the external attributes.
const FILE_MODE = 0o100_644
const HIGH_HALF = 0x1_00_00
const FILE_ATTRIBUTES = FILE_MODE * HIGH_HALF
const BEST_COMPRESSION = 9
const U16 = 2
const U32 = 4

type Field = readonly [bytes: typeof U16 | typeof U32, value: number]

export interface ZipEntry {
  // By its path from the root of the archive, with forward slashes.
  readonly path: string
  readonly content: Uint8Array
}

interface CompressedEntry {
  readonly name: Buffer
  readonly data: Buffer
  readonly crc: number
  readonly size: number
}

export function zipArchive(entries: readonly ZipEntry[]): Uint8Array {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const entry of entries.map(compressed)) {
    const local = Buffer.concat([
      littleEndian([[U32, LOCAL_SIGNATURE], ...common(entry)]),
      entry.name,
      entry.data,
    ])
    centrals.push(Buffer.concat([centralHeader(entry, offset), entry.name]))
    locals.push(local)
    offset += local.length
  }
  const directory = Buffer.concat(centrals)
  const end = littleEndian([
    [U32, END_SIGNATURE],
    [U16, 0],
    [U16, 0],
    [U16, entries.length],
    [U16, entries.length],
    [U32, directory.length],
    [U32, offset],
    [U16, 0],
  ])
  return Buffer.concat([...locals, directory, end])
}

function compressed({ path, content }: ZipEntry): CompressedEntry {
  return {
    name: Buffer.from(path, 'utf8'),
    data: deflateRawSync(content, { level: BEST_COMPRESSION }),
    crc: crc32(content),
    size: content.length,
  }
}

// The fields the local header and the central directory share, from the version needed to the
// length of the extra field (none).
function common(entry: CompressedEntry): Field[] {
  return [
    [U16, VERSION_NEEDED],
    [U16, UTF8_NAMES],
    [U16, DEFLATE],
    [U16, DOS_TIME],
    [U16, DOS_DATE],
    [U32, entry.crc],
    [U32, entry.data.length],
    [U32, entry.size],
    [U16, entry.name.length],
    [U16, 0],
  ]
}

// Then no comment, disk 0, no internal attributes, the external ones and where the local header is.
function centralHeader(entry: CompressedEntry, localOffset: number): Buffer {
  return littleEndian([
    [U32, CENTRAL_SIGNATURE],
    [U16, MADE_BY_UNIX],
    ...common(entry),
    [U16, 0],
    [U16, 0],
    [U16, 0],
    [U32, FILE_ATTRIBUTES],
    [U32, localOffset],
  ])
}

function littleEndian(fields: readonly Field[]): Buffer {
  const buffer = Buffer.alloc(fields.reduce((total, [bytes]) => total + bytes, 0))
  let offset = 0
  for (const [bytes, value] of fields) {
    buffer.writeUIntLE(value, offset, bytes)
    offset += bytes
  }
  return buffer
}
