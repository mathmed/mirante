import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { readPng } from '../../test/support/png.ts'
import { readZip, type ZipFile } from '../../test/support/zip.ts'
import { readBytes, readOptionalText, readText, writeText } from '../shared/files.ts'
import { type PackageOptions, packageWidget } from './package.ts'

const REPOSITORY = join(import.meta.dirname, '../..')
const URL = 'http://immich.test:8085'
const WIDGET_FILES = ['assets/index.js', 'config.json', 'config.xml', 'icon.png', 'index.html']

let root = ''
let out = ''

function options(overrides: Partial<PackageOptions> = {}): PackageOptions {
  return { root, outDirectory: out, environment: { MIRANTE_IMMICH_URL: URL }, ...overrides }
}

async function wgtFiles(): Promise<ZipFile[]> {
  return readZip(await readBytes(join(out, 'Mirante.wgt')))
}

function textOf(files: readonly ZipFile[], path: string): string {
  return Buffer.from(files.find((file) => file.path === path)?.content ?? []).toString()
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mirante-tizen-'))
  out = join(root, 'build', 'tizen')
  await writeText(join(root, 'package.json'), JSON.stringify({ name: 'mirante', version: '1.4.2' }))
  await writeText(
    join(root, 'tizen', 'config.xml'),
    await readText(join(REPOSITORY, 'tizen', 'config.xml')),
  )
  await writeText(join(root, 'dist', 'index.html'), '<!doctype html>')
  await writeText(join(root, 'dist', 'assets', 'index.js'), 'console.log(1)')
})

describe('packageWidget', () => {
  it('should zip the build with its config.xml, config.json and icon, unsigned', async () => {
    const sut = await packageWidget(options())

    expect(sut).toStrictEqual({ wgtPath: join(out, 'Mirante.wgt'), files: WIDGET_FILES })
    const files = await wgtFiles()
    expect(files.map((file) => file.path)).toStrictEqual(WIDGET_FILES)
    expect(textOf(files, 'config.xml')).toContain('<widget version="1.4.2" ')
    expect(textOf(files, 'config.xml')).toContain('id="MirantTV01.Mirante"')
    expect(JSON.parse(textOf(files, 'config.json'))).toStrictEqual({ immichUrl: URL })
    expect(textOf(files, 'assets/index.js')).toBe('console.log(1)')
    const icon = readPng(
      files.find((file) => file.path === 'icon.png')?.content ?? new Uint8Array(),
    )
    expect([icon.width, icon.height]).toStrictEqual([117, 117])
    expect(files.map((file) => file.path)).not.toContain('author-signature.xml')
  })

  it('should leave the folder of the widget next to the .wgt, for the Tizen CLI to sign', async () => {
    await packageWidget(options())

    const stage = join(out, 'widget')
    expect(await readText(join(stage, 'config.xml'))).toBe(textOf(await wgtFiles(), 'config.xml'))
    expect(await readText(join(stage, 'index.html'))).toBe('<!doctype html>')
  })

  it('should read tizen/config.json when MIRANTE_IMMICH_URL is not set', async () => {
    await writeText(
      join(root, 'tizen', 'config.json'),
      JSON.stringify({ immichUrl: URL, slideshowSeconds: 5 }),
    )

    await packageWidget(options({ environment: {} }))

    expect(JSON.parse(textOf(await wgtFiles(), 'config.json'))).toStrictEqual({
      immichUrl: URL,
      slideshowSeconds: 5,
    })
  })

  it('should replace a config.json left in the build and start the folder from scratch', async () => {
    await writeText(
      join(root, 'dist', 'config.json'),
      JSON.stringify({ immichUrl: '', apiKey: 'k' }),
    )
    await writeText(join(out, 'widget', 'stale.js'), 'old')

    await packageWidget(options())

    expect(textOf(await wgtFiles(), 'config.json')).not.toContain('apiKey')
    expect(await readOptionalText(join(out, 'widget', 'stale.js'))).toBeUndefined()
    expect((await wgtFiles()).map((file) => file.path)).toStrictEqual(WIDGET_FILES)
  })

  it('should write the same .wgt for the same build', async () => {
    await packageWidget(options())
    const first = await readBytes(join(out, 'Mirante.wgt'))

    await packageWidget(options())

    expect(await readBytes(join(out, 'Mirante.wgt'))).toStrictEqual(first)
  })

  it('should ask for the build when there is none', async () => {
    await writeText(join(root, 'dist', 'index.html'), '')
    const withoutBuild = await mkdtemp(join(tmpdir(), 'mirante-tizen-'))
    await writeText(join(withoutBuild, 'package.json'), JSON.stringify({ version: '1.0.0' }))
    await writeText(
      join(withoutBuild, 'tizen', 'config.xml'),
      await readText(join(root, 'tizen', 'config.xml')),
    )

    await expect(packageWidget(options({ root: withoutBuild }))).rejects.toThrow(
      'O build não tem index.html: rode make build antes.',
    )
  })

  it('should not package without a configuration, nor with an API key', async () => {
    await expect(packageWidget(options({ environment: {} }))).rejects.toThrow(
      'Falta a configuração do app empacotado: copie tizen/config.example.json para tizen/config.json',
    )
    await writeText(
      join(root, 'tizen', 'config.json'),
      JSON.stringify({ immichUrl: URL, apiKey: 'secret' }),
    )

    await expect(packageWidget(options({ environment: {} }))).rejects.toThrow(
      'Tire o apiKey do tizen/config.json',
    )
    expect(await readOptionalText(join(out, 'Mirante.wgt'))).toBeUndefined()
  })

  it('should refuse a version of package.json the Tizen tools do not take', async () => {
    await writeText(join(root, 'package.json'), JSON.stringify({ version: '1.0.0-beta' }))

    await expect(packageWidget(options())).rejects.toThrow(
      'A versão do package.json (1.0.0-beta) não serve para o Tizen',
    )
  })
})
