import { copyFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { writeBytes } from '../shared/files.ts'
import { main } from './cli.ts'
import { LOGO_FONT } from './files.ts'

const REPOSITORY = join(import.meta.dirname, '../..')

let root = ''
let log: MockInstance<typeof console.log>
let error: MockInstance<typeof console.error>

beforeEach(async () => {
  log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  root = await mkdtemp(join(tmpdir(), 'mirante-logo-cli-'))
  await writeBytes(join(root, LOGO_FONT), new Uint8Array())
  await copyFile(join(REPOSITORY, LOGO_FONT), join(root, LOGO_FONT))
})

describe('logo command line', () => {
  it('should write the logo files and list them', async () => {
    const sut = await main(['write'], { root })

    expect(sut).toBe(0)
    expect(log).toHaveBeenCalledWith(
      'Arquivos do logo escritos:\n  src/ui/assets/mirante-mark.svg\n  src/ui/assets/mirante-icon.svg\n  docs/logo/mirante-icon.svg\n  docs/logo/mirante-logo.svg',
    )
  })

  it('should say when the files are already up to date', async () => {
    await main(['write'], { root })

    const sut = await main(['write'], { root })

    expect(sut).toBe(0)
    expect(log).toHaveBeenLastCalledWith('Os arquivos do logo já estão em dia.')
  })

  it.each([[[]], [['draw']]])(
    'should refuse an unknown command %j with the usage',
    async (argv) => {
      const sut = await main(argv, { root })

      expect(sut).toBe(2)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('uso:\n  logo write'))
    },
  )
})
