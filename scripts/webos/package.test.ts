import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { fakeAresPackage } from '../../test/support/ipk.ts'
import { readPng } from '../../test/support/png.ts'
import { readBytes, readOptionalText, readText, writeText } from '../shared/files.ts'
import { aresPackageCommand } from './ares.ts'
import { packageApp, type PackageOptions } from './package.ts'

const REPOSITORY = join(import.meta.dirname, '../..')
const APP_ID = 'com.mathmed.mirante'
const URL = 'http://immich.test:8085'
const IPK = `${APP_ID}_1.4.2_all.ipk`
const APP_FILES = [
  'appinfo.json',
  'assets/index.js',
  'config.json',
  'icon.png',
  'index.html',
  'largeIcon.png',
]

let root = ''
let out = ''
let ares = fakeAresPackage(IPK)

function options(overrides: Partial<PackageOptions> = {}): PackageOptions {
  return {
    root,
    outDirectory: out,
    environment: { MIRANTE_IMMICH_URL: URL },
    runCommand: ares.run,
    ...overrides,
  }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mirante-webos-'))
  out = join(root, 'build', 'webos')
  ares = fakeAresPackage(IPK)
  await writeText(join(root, 'package.json'), JSON.stringify({ name: 'mirante', version: '1.4.2' }))
  await writeText(
    join(root, 'webos', 'appinfo.json'),
    await readText(join(REPOSITORY, 'webos', 'appinfo.json')),
  )
  await writeText(join(root, 'dist', 'index.html'), '<!doctype html>')
  await writeText(join(root, 'dist', 'assets', 'index.js'), 'console.log(1)')
})

describe('packageApp', () => {
  it('should package the build with its appinfo.json, config.json and icons', async () => {
    const sut = await packageApp(options())

    expect(sut).toStrictEqual({ ipkPath: join(out, IPK), files: APP_FILES })
    expect(ares.commands).toStrictEqual([aresPackageCommand(join(out, 'app'), out)])
    const stage = join(out, 'app')
    expect(JSON.parse(await readText(join(stage, 'appinfo.json')))).toMatchObject({
      id: APP_ID,
      version: '1.4.2',
    })
    expect(JSON.parse(await readText(join(stage, 'config.json')))).toStrictEqual({ immichUrl: URL })
    expect(await readText(join(stage, 'assets', 'index.js'))).toBe('console.log(1)')
    expect(readPng(await readBytes(join(stage, 'icon.png'))).width).toBe(80)
    expect(readPng(await readBytes(join(stage, 'largeIcon.png'))).width).toBe(130)
  })

  it('should read webos/config.json when MIRANTE_IMMICH_URL is not set', async () => {
    await writeText(
      join(root, 'webos', 'config.json'),
      JSON.stringify({ immichUrl: URL, slideshowSeconds: 5 }),
    )

    await packageApp(options({ environment: {} }))

    expect(JSON.parse(await readText(join(out, 'app', 'config.json')))).toStrictEqual({
      immichUrl: URL,
      slideshowSeconds: 5,
    })
  })

  it('should replace a config.json left in the build and start the folder from scratch', async () => {
    await writeText(
      join(root, 'dist', 'config.json'),
      JSON.stringify({ immichUrl: '', apiKey: 'k' }),
    )
    await writeText(join(out, 'app', 'stale.js'), 'old')

    await packageApp(options())

    expect(await readText(join(out, 'app', 'config.json'))).not.toContain('apiKey')
    expect(await readOptionalText(join(out, 'app', 'stale.js'))).toBeUndefined()
  })

  it('should ask for the build when there is none', async () => {
    await expect(
      packageApp(options({ root: join(root, 'webos', '..', 'empty') })),
    ).rejects.toThrow()
    await writeText(join(root, 'dist', 'index.html'), '')
    const withoutBuild = await mkdtemp(join(tmpdir(), 'mirante-webos-'))
    await writeText(join(withoutBuild, 'package.json'), JSON.stringify({ version: '1.0.0' }))
    await writeText(
      join(withoutBuild, 'webos', 'appinfo.json'),
      await readText(join(root, 'webos', 'appinfo.json')),
    )

    await expect(packageApp(options({ root: withoutBuild }))).rejects.toThrow(
      'O build não tem index.html: rode make build antes.',
    )
    expect(ares.commands).toStrictEqual([])
  })

  it('should not package without a configuration', async () => {
    await expect(packageApp(options({ environment: {} }))).rejects.toThrow(
      'Falta a configuração do app empacotado',
    )
    expect(ares.commands).toStrictEqual([])
  })

  it('should fail when ares-package fails', async () => {
    await expect(
      packageApp(options({ runCommand: async () => Promise.resolve(1) })),
    ).rejects.toThrow('O ares-package falhou (código 1); veja acima.')
  })

  it('should fail when the package misses a file of the app or holds one more', async () => {
    const changed = fakeAresPackage(IPK, (files) => [
      ...files.filter((file) => file.path !== 'config.json'),
      { path: 'extra.txt', content: '' },
    ])

    await expect(packageApp(options({ runCommand: changed.run }))).rejects.toThrow(
      'O .ipk não tem os arquivos do app: faltam [config.json], sobram [extra.txt].',
    )
  })
})
