import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { fakeAresPackage } from '../../test/support/ipk.ts'
import { readText, writeText } from '../shared/files.ts'
import type { Command } from './ares.ts'
import { main, type WebosContext } from './cli.ts'

const REPOSITORY = join(import.meta.dirname, '../..')
const IPK = 'com.mathmed.mirante_1.0.0_all.ipk'
const PACKAGED_FILES = ['appinfo.json', 'config.json', 'icon.png', 'index.html', 'largeIcon.png']

let root = ''
let log: MockInstance<typeof console.log>
let error: MockInstance<typeof console.error>

function context(runCommand: (command: Command) => Promise<number>): WebosContext {
  return { root, environment: { MIRANTE_IMMICH_URL: 'http://immich.test:8085' }, runCommand }
}

beforeEach(async () => {
  log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  root = await mkdtemp(join(tmpdir(), 'mirante-webos-cli-'))
  await writeText(join(root, 'package.json'), JSON.stringify({ version: '1.0.0' }))
  await writeText(
    join(root, 'webos', 'appinfo.json'),
    await readText(join(REPOSITORY, 'webos', 'appinfo.json')),
  )
  await writeText(join(root, 'dist', 'index.html'), '')
})

describe('webos command line', () => {
  it('should package into build/webos by default, and explain a package that misses files', async () => {
    const ares = fakeAresPackage(IPK, () => [{ path: 'index.html', content: '' }])

    const sut = await main(['package'], context(ares.run))

    expect(sut).toBe(1)
    const out = join(root, 'build', 'webos')
    expect(ares.commands[0]?.slice(-2)).toStrictEqual([out, join(out, 'app')])
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/^Empacotamento falhou: O \.ipk não tem os arquivos do app: faltam \[/),
    )
  })

  it('should say where the package is and what it holds, in the folder asked for', async () => {
    const sut = await main(['package', '--out', 'elsewhere'], context(fakeAresPackage(IPK).run))

    expect(sut).toBe(0)
    const ipkPath = join(root, 'elsewhere', IPK)
    expect(log).toHaveBeenCalledWith(
      `Pacote do webOS criado: ${ipkPath}\n  ${PACKAGED_FILES.join('\n  ')}`,
    )
  })

  it('should not hide an unexpected failure', async () => {
    await expect(
      main(
        ['package'],
        context(async () => Promise.reject(new RangeError('broken'))),
      ),
    ).rejects.toThrow(RangeError)
  })

  it.each([[['build']], [[]]])('should explain the usage for %j', async (argv) => {
    expect(
      await main(
        argv,
        context(async () => Promise.resolve(0)),
      ),
    ).toBe(2)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('uso:'))
  })
})
