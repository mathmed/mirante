import { mkdtemp, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { setup } from './temp-root.ts'

const PREFIXES = [
  'mirante-cli-',
  'mirante-mutation-',
  'mirante-files-',
  'mirante-run-',
  'mirante-fragments-',
  'mirante-stryker-',
  'mirante-git-',
  'mirante-elsewhere-',
]

describe('temp root', () => {
  it('should keep the temporary directories of the tests out of the system one', () => {
    expect(tmpdir()).toContain(join('.tmp', 'vitest-'))
  })

  it('should leave no temporary directory behind when the run ends', async () => {
    const outer = tmpdir()
    const sut = await setup()
    const root = tmpdir()
    for (const prefix of PREFIXES) {
      await mkdtemp(join(root, prefix))
    }

    await sut()

    expect(tmpdir()).toBe(outer)
    await expect(stat(root)).rejects.toThrow('ENOENT')
  })
})
