import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { writeText } from '../shared/files.ts'
import { main } from './cli.ts'

let root = ''
let log: MockInstance<typeof console.log>
let error: MockInstance<typeof console.error>

function printed(spy: MockInstance<typeof console.log>): string[] {
  return spy.mock.calls.map(([text]) => String(text))
}

beforeEach(async () => {
  log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  root = await mkdtemp(join(tmpdir(), 'mirante-browser-apis-cli-'))
  await writeText(join(root, 'package.json'), JSON.stringify({ browserslist: ['chrome >= 68'] }))
  await writeText(
    join(root, '.browser-apis.json'),
    JSON.stringify({ polyfilled: ['queueMicrotask'] }),
  )
  await writeText(join(root, 'dist', 'index.html'), '<script src="./assets/a.js"></script>')
  await writeText(join(root, 'dist', 'assets', 'a.js'), 'queueMicrotask(f)')
  await writeText(join(root, 'build', 'webos', 'assets', 'b.js'), 'fetch(u)')
})

describe('browser-apis command line', () => {
  it('should pass the scripts of every folder that use only what the oldest Chrome has', async () => {
    const sut = await main(['dist', 'build/webos'], { root })

    expect(sut).toBe(0)
    expect(printed(log)).toStrictEqual([
      'Browser APIs: 2 script(s) use only what Chrome 68 has (polyfilled: queueMicrotask).',
    ])
  })

  it('should fail with every API the oldest Chrome lacks, where it is read', async () => {
    await writeText(
      join(root, 'dist', 'assets', 'c.js'),
      'structuredClone(a)\nObject.fromEntries(e)',
    )

    const sut = await main(['dist'], { root })

    expect(sut).toBe(1)
    const script = join(root, 'dist', 'assets', 'c.js')
    expect(printed(error)).toStrictEqual([
      expect.stringContaining(
        `${script}:1:1 structuredClone is missing in Chrome 68 (added in 98)`,
      ),
      expect.stringContaining(
        `${script}:2:1 Object.fromEntries is missing in Chrome 68 (added in 73)`,
      ),
      'Browser APIs: 2 missing in Chrome 68.',
    ])
    expect(log).not.toHaveBeenCalled()
  })

  it('should fail when the folders hold no script: the build did not run', async () => {
    await writeText(join(root, 'empty', 'index.html'), '')

    expect(await main(['empty'], { root })).toBe(1)
    expect(printed(error)).toStrictEqual(['No script to check in empty: run the build first.'])
  })

  it('should explain the usage without a folder', async () => {
    expect(await main([], { root })).toBe(2)
    expect(printed(error)).toStrictEqual([expect.stringContaining('usage:')])
  })
})
