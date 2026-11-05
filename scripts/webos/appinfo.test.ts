import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readText } from '../shared/files.ts'
import { appInfoOf, versionOf } from './appinfo.ts'

const ROOT = join(import.meta.dirname, '../..')
const TEMPLATE = {
  id: 'com.mathmed.mirante',
  title: 'Mirante',
  type: 'web',
  main: 'index.html',
  icon: 'icon.png',
  largeIcon: 'largeIcon.png',
  disableBackHistoryAPI: true,
}

function templateWith(fields: Readonly<Record<string, unknown>>): string {
  return JSON.stringify({ ...TEMPLATE, ...fields })
}

describe('the appinfo.json of the repository', () => {
  it('should describe Mirante as a web app, at the version of package.json', async () => {
    const version = versionOf(await readText(join(ROOT, 'package.json')))

    const sut = appInfoOf(await readText(join(ROOT, 'webos/appinfo.json')), version)

    expect(sut).toMatchObject({
      id: 'com.mathmed.mirante',
      title: 'Mirante',
      main: 'index.html',
      version,
    })
    expect(JSON.parse(sut.text)).toStrictEqual({
      ...TEMPLATE,
      vendor: 'Mateus Medeiros de Araujo',
      appDescription: 'As fotos do Immich na TV',
      resolution: '1920x1080',
      requiredACG: [],
      version,
    })
  })
})

describe('appInfoOf', () => {
  it('should add the version to the fields of the template, in a file of its own', () => {
    const sut = appInfoOf(templateWith({ vendor: 'Mateus' }), '1.2.3')

    expect(sut.text).toBe(
      `${JSON.stringify({ ...TEMPLATE, vendor: 'Mateus', version: '1.2.3' }, null, 2)}\n`,
    )
  })

  it.each(['id', 'title', 'type', 'main', 'icon', 'largeIcon'])(
    'should refuse a template without %s',
    (field) => {
      expect(() => appInfoOf(templateWith({ [field]: ' ' }), '1.0.0')).toThrow(
        `Falta o campo ${field} no webos/appinfo.json.`,
      )
      expect(() => appInfoOf(templateWith({ [field]: 7 }), '1.0.0')).toThrow(field)
    },
  )

  it('should refuse an id ares-package does not take', () => {
    expect(() => appInfoOf(templateWith({ id: 'com.Mathmed.mirante' }), '1.0.0')).toThrow(
      'O id "com.Mathmed.mirante" do webos/appinfo.json não serve para o webOS',
    )
  })

  it('should refuse an app that is not a web app', () => {
    expect(() => appInfoOf(templateWith({ type: 'native' }), '1.0.0')).toThrow(
      'O type do webos/appinfo.json precisa ser "web".',
    )
  })

  it('should refuse a version written in the template', () => {
    expect(() => appInfoOf(templateWith({ version: '1.0.0' }), '1.0.0')).toThrow(
      'Tire o campo version do webos/appinfo.json: a versão do app vem do package.json.',
    )
  })

  it.each([false, undefined])('should refuse to leave Back to the system (%s)', (isDisabled) => {
    expect(() => appInfoOf(templateWith({ disableBackHistoryAPI: isDisabled }), '1.0.0')).toThrow(
      'O webos/appinfo.json precisa de "disableBackHistoryAPI": true',
    )
  })

  it.each(['[]', '"Mirante"', 'null'])(
    'should refuse a template that is not an object: %s',
    (text) => {
      expect(() => appInfoOf(text, '1.0.0')).toThrow(
        'O webos/appinfo.json precisa ser um objeto JSON, entre chaves.',
      )
    },
  )

  it('should refuse a template that is not JSON', () => {
    expect(() => appInfoOf('{"id": ', '1.0.0')).toThrow('O webos/appinfo.json não é um JSON válido')
  })

  it('should let through what JSON.parse throws besides a syntax error', () => {
    const notText = Symbol('not text') as unknown as string

    expect(() => appInfoOf(notText, '1.0.0')).toThrow(TypeError)
  })
})

describe('versionOf', () => {
  it.each(['0.0.0', '1.2.3', '10.0.123456789'])('should take the version %s', (version) => {
    expect(versionOf(JSON.stringify({ version }))).toBe(version)
  })

  it.each(['1.2', '1.2.3-beta.1', '01.2.3', '1.2.3.4.5', 7])(
    'should refuse a version the webOS does not take: %s',
    (version) => {
      expect(() => versionOf(JSON.stringify({ version }))).toThrow(
        `A versão do package.json (${String(version)}) não serve para o webOS`,
      )
    },
  )
})
