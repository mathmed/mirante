import { describe, expect, it } from 'vitest'

import { readZip } from '../../test/support/zip.ts'
import { zipArchive } from './zip.ts'

const INDEX = { path: 'index.html', content: Buffer.from('<!doctype html>') }
const SCRIPT = { path: 'assets/index-a1.js', content: Buffer.from('console.log(1)\n'.repeat(500)) }

describe('zipArchive', () => {
  it('should hold every file, deflated, under its path', () => {
    const sut = readZip(zipArchive([INDEX, SCRIPT]))

    expect(sut.map((file) => [file.path, Buffer.from(file.content).toString()])).toStrictEqual([
      [INDEX.path, '<!doctype html>'],
      [SCRIPT.path, 'console.log(1)\n'.repeat(500)],
    ])
    expect(sut.map((file) => file.method)).toStrictEqual([8, 8])
  })

  it('should shrink what compresses', () => {
    expect(zipArchive([SCRIPT]).length).toBeLessThan(SCRIPT.content.length / 10)
  })

  it('should write regular files readable by everyone, with UTF-8 names, on the earliest date', () => {
    const [sut] = readZip(zipArchive([{ path: 'ícone.png', content: new Uint8Array([1, 2]) }]))

    expect(sut).toMatchObject({ path: 'ícone.png', flags: 0x0800, time: 0, date: 0x21 })
    expect(sut?.mode).toBe(0o100644)
  })

  it('should write the same bytes for the same files', () => {
    expect(zipArchive([INDEX, SCRIPT])).toStrictEqual(zipArchive([INDEX, SCRIPT]))
  })

  it('should write an empty file and an empty archive', () => {
    expect(readZip(zipArchive([{ path: 'empty', content: new Uint8Array() }]))).toMatchObject([
      { path: 'empty', content: new Uint8Array() },
    ])
    expect(readZip(zipArchive([]))).toStrictEqual([])
  })
})
