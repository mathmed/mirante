import { copyFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { readText, writeBytes, writeText } from '../shared/files.ts'
import { LOGO_FONT, logoFiles, writeLogoFiles } from './files.ts'

const REPOSITORY = join(import.meta.dirname, '../..')
const PATHS = [
  'src/ui/assets/mirante-mark.svg',
  'src/ui/assets/mirante-icon.svg',
  'docs/logo/mirante-icon.svg',
  'docs/logo/mirante-logo.svg',
]

let root = ''

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mirante-logo-'))
  await writeBytes(join(root, LOGO_FONT), new Uint8Array())
  await copyFile(join(REPOSITORY, LOGO_FONT), join(root, LOGO_FONT))
})

describe('logoFiles', () => {
  it('should match the logo files of the repository: run make logo after changing the mark', async () => {
    for (const file of await logoFiles(REPOSITORY)) {
      expect(await readText(join(REPOSITORY, file.path)), file.path).toBe(file.text)
    }
  })

  it('should give the mark and the icon of the app and the icon and the logo of the docs', async () => {
    const sut = await logoFiles(root)

    expect(sut.map((file) => file.path)).toStrictEqual(PATHS)
  })
})

describe('writeLogoFiles', () => {
  it('should write every file that is missing', async () => {
    const sut = await writeLogoFiles(root)

    expect(sut).toStrictEqual(PATHS)
    const files = await logoFiles(root)
    for (const file of files) {
      expect(await readText(join(root, file.path))).toBe(file.text)
    }
  })

  it('should leave alone the files already up to date and write only the changed one', async () => {
    await writeLogoFiles(root)
    await writeText(join(root, 'docs/logo/mirante-icon.svg'), '<svg/>')

    expect(await writeLogoFiles(root)).toStrictEqual(['docs/logo/mirante-icon.svg'])
    expect(await writeLogoFiles(root)).toStrictEqual([])
  })
})
