import { describe, expect, it } from 'vitest'

import {
  ConfigProblem,
  invalidConfig,
  parseRuntimeConfig,
  type RuntimeConfig,
  serverAddress,
} from './runtime-config.ts'

const IMMICH_URL = 'https://192.168.0.10:2283'
const API_KEY = 'read-only-key'

function configText(fields: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(fields)
}

describe('parseRuntimeConfig', () => {
  it('should read the Immich address and the API key', () => {
    const sut = parseRuntimeConfig(configText({ immichUrl: IMMICH_URL, apiKey: API_KEY }))

    expect(sut).toStrictEqual({ isValid: true, config: { immichUrl: IMMICH_URL, apiKey: API_KEY } })
  })

  it('should drop the blanks around the values and the slashes after the address', () => {
    const text = configText({ immichUrl: ` ${IMMICH_URL}// `, apiKey: ` ${API_KEY}\n` })

    expect(parseRuntimeConfig(text)).toStrictEqual({
      isValid: true,
      config: { immichUrl: IMMICH_URL, apiKey: API_KEY },
    })
  })

  it.each([
    'https://photos.example.com',
    'HTTPS://photos.example.com',
    'http://localhost:2283',
    'https://example.com/immich',
  ])('should accept the address %s', (immichUrl) => {
    expect(parseRuntimeConfig(configText({ immichUrl, apiKey: API_KEY })).isValid).toBe(true)
  })

  it.each(['', 'not json', '{', '[]', 'null', '42', '"text"'])(
    'should reject %j as malformed',
    (text) => {
      expect(parseRuntimeConfig(text)).toStrictEqual(invalidConfig(ConfigProblem.Malformed))
    },
  )

  it.each([
    undefined,
    42,
    '',
    'photos.example.com',
    'ftp://photos.example.com',
    'http://',
    'https:///path',
    'https://photos example.com',
    'https://photos.example.com?key=1',
    'https://photos.example.com/#top',
    'xhttp://photos.example.com',
  ])('should reject the address %j', (immichUrl) => {
    expect(parseRuntimeConfig(configText({ immichUrl, apiKey: API_KEY }))).toStrictEqual(
      invalidConfig(ConfigProblem.InvalidImmichUrl),
    )
  })

  it.each([undefined, 42, '', '   '])('should reject the API key %j', (apiKey) => {
    expect(parseRuntimeConfig(configText({ immichUrl: IMMICH_URL, apiKey }))).toStrictEqual(
      invalidConfig(ConfigProblem.InvalidApiKey),
    )
  })

  it('should let through what JSON.parse throws besides a syntax error', () => {
    const notText = Symbol('not text') as unknown as string

    expect(() => parseRuntimeConfig(notText)).toThrow(TypeError)
  })

  it('should check the address before the key', () => {
    expect(parseRuntimeConfig(configText({}))).toStrictEqual(
      invalidConfig(ConfigProblem.InvalidImmichUrl),
    )
  })
})

describe('serverAddress', () => {
  it.each([
    ['http://localhost:2283', 'localhost:2283'],
    ['HTTPS://photos.example.com/immich', 'photos.example.com/immich'],
  ])('should show %s as %s', (immichUrl, address) => {
    const config: RuntimeConfig = { immichUrl, apiKey: API_KEY }

    expect(serverAddress(config)).toBe(address)
  })
})
