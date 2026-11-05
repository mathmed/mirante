import { gunzipSync } from 'node:zlib'

import { PackagingError } from '../packaging/packaging-error.ts'

// An .ipk is an ar archive of three members: debian-binary, control.tar.gz and data.tar.gz, the
// files installed on the TV. Read here to check what ares-package put in it.
const AR_MAGIC = '!<arch>\n'
const AR_HEADER_BYTES = 60
const AR_NAME_BYTES = 16
const AR_SIZE_START = 48
const AR_SIZE_END = 58
// Every member starts on an even byte.
const MEMBER_ALIGNMENT = 2
const NUL = '\0'
const DATA_MEMBER = 'data.tar.gz'
// tar: 512-byte blocks, a header block before the content of each entry.
const BLOCK_BYTES = 512
const TAR_NAME_BYTES = 100
const TAR_SIZE_START = 124
const TAR_SIZE_END = 136
const TAR_TYPE_AT = 156
const TAR_PREFIX_START = 345
const TAR_PREFIX_END = 500
const OCTAL = 8
const FILE_TYPES: ReadonlySet<string> = new Set(['0', '\0'])
const CURRENT_FOLDER = './'
const SLASH = '/'
// Where the TV installs each app: one folder per app id.
const APPLICATIONS = 'usr/palm/applications/'

export interface ArchiveFile {
  readonly path: string
  readonly content: Uint8Array
}

// The files the package installs, by their path from the root of the TV.
export function ipkFiles(ipk: Uint8Array): readonly ArchiveFile[] {
  const data = arMembers(Buffer.from(ipk)).get(DATA_MEMBER)
  if (data === undefined) {
    throw new PackagingError(`O .ipk não tem ${DATA_MEMBER}.`)
  }
  return tarFiles(gunzipSync(data))
}

// The files of the app, by their path from its own folder.
export function appFiles(files: readonly ArchiveFile[], appId: string): readonly ArchiveFile[] {
  const folder = `${APPLICATIONS}${appId}${SLASH}`
  return files
    .filter((file) => file.path.startsWith(folder))
    .map((file) => ({ ...file, path: file.path.slice(folder.length) }))
}

function arMembers(archive: Buffer): ReadonlyMap<string, Buffer> {
  if (archive.subarray(0, AR_MAGIC.length).toString('latin1') !== AR_MAGIC) {
    throw new PackagingError('O .ipk não é um arquivo ar.')
  }
  const members = new Map<string, Buffer>()
  let offset = AR_MAGIC.length
  while (offset + AR_HEADER_BYTES <= archive.length) {
    const header = archive.subarray(offset, offset + AR_HEADER_BYTES)
    const size = Number.parseInt(text(header, AR_SIZE_START, AR_SIZE_END), 10)
    const start = offset + AR_HEADER_BYTES
    // GNU ar ends the names with a slash.
    members.set(
      text(header, 0, AR_NAME_BYTES).replace(/\/$/, ''),
      archive.subarray(start, start + size),
    )
    offset = start + size + (size % MEMBER_ALIGNMENT)
  }
  return members
}

function tarFiles(tar: Buffer): readonly ArchiveFile[] {
  const files: ArchiveFile[] = []
  let offset = 0
  while (offset + BLOCK_BYTES <= tar.length && tar.readUInt8(offset) !== 0) {
    const header = tar.subarray(offset, offset + BLOCK_BYTES)
    const size = Number.parseInt(text(header, TAR_SIZE_START, TAR_SIZE_END), OCTAL)
    const start = offset + BLOCK_BYTES
    if (FILE_TYPES.has(header.toString('latin1', TAR_TYPE_AT, TAR_TYPE_AT + 1))) {
      files.push({ path: tarPath(header), content: tar.subarray(start, start + size) })
    }
    offset = start + Math.ceil(size / BLOCK_BYTES) * BLOCK_BYTES
  }
  return files
}

// ustar splits a long path in a prefix and a name.
function tarPath(header: Buffer): string {
  const name = text(header, 0, TAR_NAME_BYTES)
  const prefix = text(header, TAR_PREFIX_START, TAR_PREFIX_END)
  const path = prefix === '' ? name : `${prefix}${SLASH}${name}`
  return path.startsWith(CURRENT_FOLDER) ? path.slice(CURRENT_FOLDER.length) : path
}

// A field of a header, without the NUL bytes and spaces that pad it.
function text(header: Buffer, start: number, end: number): string {
  const field = header.toString('latin1', start, end)
  const nul = field.indexOf(NUL)
  return (nul === -1 ? field : field.slice(0, nul)).trim()
}
