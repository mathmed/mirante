// Builds .ipk files the way ares-package does (an ar archive of debian-binary, control.tar.gz and
// data.tar.gz, with ustar entries), for the tests of the packaging, which never run the real tool.
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

import { listFilesDeep } from '../../scripts/shared/files.ts'

const BLOCK = 512
const NAME_BYTES = 100
const PREFIX_START = 345
const APPLICATIONS = 'usr/palm/applications'

export interface IpkFile {
  readonly path: string
  readonly content: string | Uint8Array
}

// An .ipk that installs the files in the folder of the app, as ares-package lays them out.
export function appIpk(appId: string, files: readonly IpkFile[]): Uint8Array {
  const folder = `./${APPLICATIONS}/${appId}`
  return ipk([
    { path: `${folder}/`, isDirectory: true },
    ...files.map((file) => ({ path: `${folder}/${file.path}`, content: file.content })),
  ])
}

// Stands in for ares-package (its command ends with the output folder and the app's folder):
// packages the folder it is given, which `change` may alter, and records the commands.
export function fakeAresPackage(
  ipkName: string,
  change: (files: IpkFile[]) => IpkFile[] = (files) => files,
): {
  readonly commands: (readonly string[])[]
  readonly run: (command: readonly string[]) => Promise<number>
} {
  const commands: (readonly string[])[] = []
  const run = async (command: readonly string[]): Promise<number> => {
    commands.push(command)
    const [outDirectory = '', stage = ''] = command.slice(-2)
    const files = await Promise.all(
      (await listFilesDeep(stage)).map(async (path) => ({
        path,
        content: new Uint8Array(await readFile(join(stage, path))),
      })),
    )
    const [appId = ''] = ipkName.split('_')
    await writeFile(join(outDirectory, ipkName), appIpk(appId, change(files)))
    return 0
  }
  return { commands, run }
}

interface TarEntry {
  readonly path: string
  readonly content?: string | Uint8Array
  readonly isDirectory?: boolean
}

export function ipk(entries: readonly TarEntry[]): Uint8Array {
  return arArchive([
    ['debian-binary', Buffer.from('2.0\n')],
    ['control.tar.gz', gzipSync(tar([{ path: './control', content: 'Package: test\n' }]))],
    ['data.tar.gz', gzipSync(tar(entries))],
  ])
}

export function arArchive(members: readonly (readonly [string, Buffer])[]): Uint8Array {
  const parts: Uint8Array[] = [Buffer.from('!<arch>\n', 'latin1')]
  for (const [name, data] of members) {
    const header = [
      `${name}/`.padEnd(16),
      '0'.padEnd(12),
      '0'.padEnd(6),
      '0'.padEnd(6),
      '100644'.padEnd(8),
      String(data.length).padEnd(10),
      '`\n',
    ].join('')
    parts.push(Buffer.from(header, 'latin1'), data)
    if (data.length % 2 === 1) {
      parts.push(Buffer.from('\n'))
    }
  }
  return Buffer.concat(parts)
}

export function tar(entries: readonly TarEntry[]): Buffer {
  const blocks = entries.flatMap((entry) => {
    const content = Buffer.from(entry.content ?? '')
    const padding = Buffer.alloc((BLOCK - (content.length % BLOCK)) % BLOCK)
    return [tarHeader(entry, content.length), content, padding]
  })
  return Buffer.concat([...blocks, Buffer.alloc(BLOCK * 2)])
}

function tarHeader(entry: TarEntry, size: number): Buffer {
  const header = Buffer.alloc(BLOCK)
  const [prefix, name] = splitPath(entry.path)
  header.write(name, 0, 'latin1')
  header.write('0000644\0', 100, 'latin1')
  header.write('0000000\0', 108, 'latin1')
  header.write('0000000\0', 116, 'latin1')
  header.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 'latin1')
  header.write('00000000000\0', 136, 'latin1')
  header.write(entry.isDirectory === true ? '5' : '0', 156, 'latin1')
  header.write('ustar\0', 257, 'latin1')
  header.write('00', 263, 'latin1')
  header.write(prefix, PREFIX_START, 'latin1')
  header.write('        ', 148, 'latin1')
  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 'latin1')
  return header
}

// ustar keeps names of up to 100 bytes and puts what comes before in the prefix.
function splitPath(path: string): readonly [string, string] {
  if (path.length <= NAME_BYTES) {
    return ['', path]
  }
  const cut = path.indexOf('/', path.length - NAME_BYTES - 1)
  return [path.slice(0, cut), path.slice(cut + 1)]
}
