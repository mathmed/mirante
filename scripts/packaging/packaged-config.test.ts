import { describe, expect, it } from 'vitest'

import { configSourceFile, packagedConfig } from './packaged-config.ts'

const URL = 'http://immich.test:8085'

function parsed(text: string): unknown {
  return JSON.parse(text)
}

describe('packagedConfig', () => {
  it('should take the address of MIRANTE_IMMICH_URL alone, without reading the file', () => {
    const sut = packagedConfig({
      folder: 'webos',
      immichUrl: ` ${URL} `,
      fileText: '{"slideshowSeconds": 5',
    })

    expect(sut).toBe(`{\n  "immichUrl": "${URL}"\n}\n`)
  })

  it('should take webos/config.json as it is when MIRANTE_IMMICH_URL is not set', () => {
    const file = { immichUrl: `${URL}/immich/`, slideshowSeconds: 5 }

    expect(
      parsed(
        packagedConfig({ folder: 'webos', immichUrl: undefined, fileText: JSON.stringify(file) }),
      ),
    ).toStrictEqual(file)
    expect(
      parsed(packagedConfig({ folder: 'webos', immichUrl: '', fileText: JSON.stringify(file) })),
    ).toStrictEqual(file)
  })

  it('should explain in Portuguese where the configuration goes when there is none', () => {
    expect(() =>
      packagedConfig({ folder: 'webos', immichUrl: undefined, fileText: undefined }),
    ).toThrow(
      'Falta a configuração do app empacotado: copie webos/config.example.json para webos/config.json e preencha o immichUrl, ou defina a variável MIRANTE_IMMICH_URL',
    )
  })

  it('should name the files of the TV it packages for', () => {
    expect(configSourceFile('tizen')).toBe('tizen/config.json')
    expect(() => packagedConfig({ folder: 'tizen', immichUrl: ' ', fileText: undefined })).toThrow(
      'copie tizen/config.example.json para tizen/config.json e preencha o immichUrl',
    )
    expect(() =>
      packagedConfig({ folder: 'tizen', immichUrl: undefined, fileText: '{"apiKey": "k"}' }),
    ).toThrow('O immichUrl precisa ser')
    expect(() =>
      packagedConfig({
        folder: 'tizen',
        immichUrl: undefined,
        fileText: JSON.stringify({ immichUrl: URL, apiKey: 'k' }),
      }),
    ).toThrow('Tire o apiKey do tizen/config.json')
  })

  it.each([
    '',
    '/',
    '/immich',
    'immich.test:8085',
    'file:///immich',
    'http://',
    `${URL}/?a=1`,
    `${URL}#top`,
    `http://a b`,
  ])('should refuse an address that does not reach the proxy from the TV: %j', (immichUrl) => {
    expect(() =>
      packagedConfig({
        folder: 'webos',
        immichUrl: undefined,
        fileText: JSON.stringify({ immichUrl }),
      }),
    ).toThrow('O immichUrl precisa ser o endereço completo do proxy do Immich')
  })

  it.each([`HTTPS://immich.example.com`, 'http://immich.test/x'])(
    'should take the address %s',
    (immichUrl) => {
      expect(
        parsed(packagedConfig({ folder: 'webos', immichUrl, fileText: undefined })),
      ).toStrictEqual({
        immichUrl,
      })
    },
  )

  it('should refuse a file without an address', () => {
    expect(() =>
      packagedConfig({ folder: 'webos', immichUrl: undefined, fileText: '{"immichUrl": 2283}' }),
    ).toThrow('O immichUrl precisa ser')
  })

  it.each(['secret', '', null])('should refuse to put an API key in the package: %j', (apiKey) => {
    expect(() =>
      packagedConfig({
        folder: 'webos',
        immichUrl: undefined,
        fileText: JSON.stringify({ immichUrl: URL, apiKey }),
      }),
    ).toThrow('Tire o apiKey do webos/config.json: o app empacotado não leva a chave de API')
  })

  it('should refuse a file that is not JSON', () => {
    expect(() => packagedConfig({ folder: 'webos', immichUrl: undefined, fileText: '{' })).toThrow(
      'O webos/config.json não é um JSON válido',
    )
  })
})
