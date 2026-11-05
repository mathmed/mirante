import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import {
  appendText,
  copyDirectory,
  listFiles,
  listFilesDeep,
  readBytes,
  readOptionalText,
  readText,
  removeDirectory,
  writeBytes,
  writeText,
} from './files.ts'
import { compareText } from './text.ts'

describe('files', () => {
  let directory = ''

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'mirante-files-'))
  })

  it('should write, append and read text, creating missing folders', async () => {
    const path = join(directory, 'nested', 'report.md')

    await writeText(path, 'first')
    await appendText(path, ' second')

    expect(await readText(path)).toBe('first second')
  })

  it('should read a file that may not exist', async () => {
    const path = join(directory, 'baseline.json')
    await writeText(path, '{}')

    expect(await readOptionalText(path)).toBe('{}')
    expect(await readOptionalText(join(directory, 'missing.json'))).toBeUndefined()
  })

  it('should not hide other errors while reading a file that may not exist', async () => {
    await expect(readOptionalText(directory)).rejects.toThrow('EISDIR')
  })

  it('should list the files of a folder', async () => {
    await writeText(join(directory, 'b.json'), '{}')
    await writeText(join(directory, 'a.json'), '{}')

    expect((await listFiles(directory)).toSorted(compareText)).toEqual(['a.json', 'b.json'])
  })

  it('should list nothing when the folder does not exist', async () => {
    expect(await listFiles(join(directory, 'missing'))).toEqual([])
  })

  it('should not hide other errors while listing a folder', async () => {
    const file = join(directory, 'file.txt')
    await writeText(file, 'not a folder')

    await expect(listFiles(file)).rejects.toThrow('ENOTDIR')
  })

  it('should write and read bytes, creating missing folders', async () => {
    const path = join(directory, 'nested', 'icon.png')

    await writeBytes(path, new Uint8Array([0x89, 0x50]))

    expect([...(await readBytes(path))]).toStrictEqual([0x89, 0x50])
  })

  it('should list every file of a folder at any depth, with forward slashes', async () => {
    await writeText(join(directory, 'index.html'), '')
    await writeText(join(directory, 'assets', 'deep', 'app.js'), '')

    expect((await listFilesDeep(directory)).toSorted(compareText)).toStrictEqual([
      'assets/deep/app.js',
      'index.html',
    ])
  })

  it('should copy a folder with everything in it', async () => {
    await writeText(join(directory, 'from', 'assets', 'app.js'), 'app')

    await copyDirectory(join(directory, 'from'), join(directory, 'to'))

    expect(await readText(join(directory, 'to', 'assets', 'app.js'))).toBe('app')
  })

  it('should not copy over a file that is already there', async () => {
    await writeText(join(directory, 'from', 'app.js'), 'new')
    await writeText(join(directory, 'to', 'app.js'), 'old')

    await expect(copyDirectory(join(directory, 'from'), join(directory, 'to'))).rejects.toThrow()
    expect(await readText(join(directory, 'to', 'app.js'))).toBe('old')
  })

  it('should remove a folder with everything in it, or one that is not there', async () => {
    await writeText(join(directory, 'stage', 'assets', 'app.js'), 'app')

    await removeDirectory(join(directory, 'stage'))
    await removeDirectory(join(directory, 'stage'))

    expect(await listFiles(directory)).toStrictEqual([])
  })
})
