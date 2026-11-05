import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { writeText } from '../shared/files.ts'
import { browserApisOptions, oldestChrome } from './options.ts'

const REPOSITORY = join(import.meta.dirname, '../..')

async function repositoryWith(browserslist: readonly string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mirante-browser-apis-'))
  await writeText(join(root, 'package.json'), JSON.stringify({ browserslist }))
  return root
}

describe('browserApisOptions', () => {
  it('should check the repository against Chrome 68 and its polyfills', () => {
    const sut = browserApisOptions(REPOSITORY, { polyfilled: ['queueMicrotask'] })

    expect(sut).toStrictEqual({ chrome: 68, polyfilled: ['queueMicrotask'] })
  })

  it('should read the browserslist of the repository it is given', async () => {
    const root = await repositoryWith(['chrome >= 85', 'firefox >= 100'])

    expect(browserApisOptions(root, { polyfilled: [] })).toStrictEqual({
      chrome: 85,
      polyfilled: [],
    })
  })

  it.each([
    [[], 'expected a JSON object'],
    [{}, 'expected "polyfilled" to be an array'],
    [
      { polyfilled: ['queueMicrotask', 7] },
      'expected every API of "polyfilled" in .browser-apis.json to be a string',
    ],
  ])('should refuse the configuration %j', (config, message) => {
    expect(() => browserApisOptions(REPOSITORY, config)).toThrow(message)
  })
})

describe('oldestChrome', () => {
  it('should take the oldest version of Chrome', () => {
    expect(oldestChrome(['chrome 70', 'chrome 68', 'chrome 69', 'edge 18'])).toBe(68)
  })

  it('should refuse a browserslist without Chrome', () => {
    expect(() => oldestChrome(['firefox 100', 'and_chr 120'])).toThrow(
      'the browserslist names no version of Chrome: firefox 100, and_chr 120',
    )
  })
})
