import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { loadMutatePatterns, mutationTargets } from './scope.ts'

const STRYKER_CONFIG = fileURLToPath(new URL('../../stryker.config.json', import.meta.url))

async function configWith(source: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'mirante-stryker-'))
  const path = join(directory, 'stryker.config.json')
  await writeFile(path, source)
  return path
}

describe('mutationTargets', () => {
  const patterns = ['src/core/**/*.ts', '!src/**/*.test.ts']

  it('should keep only the files in scope, sorted', () => {
    const files = [
      'src/core/startup.ts',
      'README.md',
      'src/core/runtime-config.test.ts',
      'src/ui/App.tsx',
      'src/core/runtime-config.ts',
    ]

    expect(mutationTargets(files, patterns)).toEqual([
      'src/core/runtime-config.ts',
      'src/core/startup.ts',
    ])
  })

  it('should find nothing to mutate when the diff misses the scope', () => {
    expect(mutationTargets(['README.md', 'src/immich/immich-library.ts'], patterns)).toEqual([])
  })
})

describe('loadMutatePatterns', () => {
  it('should read the scope from the Stryker config of the repository', async () => {
    expect(await loadMutatePatterns(STRYKER_CONFIG)).toEqual([
      'src/core/**/*.ts',
      '!src/**/*.test.ts',
    ])
  })

  it('should reject a config whose scope is not a list of globs', async () => {
    const config = await configWith('{ "mutate": ["src/**", 42] }')

    await expect(loadMutatePatterns(config)).rejects.toThrow('to list glob patterns')
  })

  it('should reject a config without a scope', async () => {
    const config = await configWith('{ "testRunner": "vitest" }')

    await expect(loadMutatePatterns(config)).rejects.toThrow('expected "mutate" to be an array')
  })
})
