import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { readText, writeText } from '../shared/files.ts'
import { main, type TizenContext } from './cli.ts'

const REPOSITORY = join(import.meta.dirname, '../..')
const WIDGET_FILES = ['config.json', 'config.xml', 'icon.png', 'index.html']

let root = ''
let log: MockInstance<typeof console.log>
let error: MockInstance<typeof console.error>

function context(environment: NodeJS.ProcessEnv): TizenContext {
  return { root, environment }
}

beforeEach(async () => {
  log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  root = await mkdtemp(join(tmpdir(), 'mirante-tizen-cli-'))
  await writeText(join(root, 'package.json'), JSON.stringify({ version: '1.0.0' }))
  await writeText(
    join(root, 'tizen', 'config.xml'),
    await readText(join(REPOSITORY, 'tizen', 'config.xml')),
  )
  await writeText(join(root, 'dist', 'index.html'), '')
})

describe('tizen command line', () => {
  it('should package into build/tizen by default and say that the .wgt is not signed', async () => {
    const sut = await main(['package'], context({ MIRANTE_IMMICH_URL: 'http://immich.test:8085' }))

    expect(sut).toBe(0)
    const wgtPath = join(root, 'build', 'tizen', 'Mirante.wgt')
    expect(log).toHaveBeenCalledWith(
      `Pacote do Tizen criado, sem assinatura: ${wgtPath}\n  ${WIDGET_FILES.join('\n  ')}\nA TV só o instala assinado com os certificados do dono: veja docs/tizen.md.`,
    )
  })

  it('should package into the folder asked for', async () => {
    const sut = await main(
      ['package', '--out', 'elsewhere'],
      context({ MIRANTE_IMMICH_URL: 'http://immich.test:8085' }),
    )

    expect(sut).toBe(0)
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(join(root, 'elsewhere', 'Mirante.wgt')),
    )
  })

  it('should explain in Portuguese what is missing', async () => {
    const sut = await main(['package'], context({}))

    expect(sut).toBe(1)
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Empacotamento falhou: Falta a configuração do app empacotado: copie tizen\/config\.example\.json/,
      ),
    )
  })

  it('should not hide an unexpected failure', async () => {
    const broken = await mkdtemp(join(tmpdir(), 'mirante-tizen-cli-'))
    await writeText(join(broken, 'package.json'), JSON.stringify({ version: '1.0.0' }))
    await writeText(
      join(broken, 'tizen', 'config.xml'),
      await readText(join(root, 'tizen', 'config.xml')),
    )
    // A file where the build folder should be: the file system fails, not the configuration.
    await writeText(join(broken, 'dist'), '')

    await expect(
      main(['package'], {
        root: broken,
        environment: { MIRANTE_IMMICH_URL: 'http://immich.test' },
      }),
    ).rejects.toThrow('ENOTDIR')
    expect(error).not.toHaveBeenCalled()
  })

  it.each([[['build']], [[]]])('should explain the usage for %j', async (argv) => {
    expect(await main(argv, context({}))).toBe(2)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('uso:'))
  })
})
