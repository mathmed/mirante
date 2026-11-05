import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { appendText, listFiles, readOptionalText, readText, writeText } from './files.ts'
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
})
