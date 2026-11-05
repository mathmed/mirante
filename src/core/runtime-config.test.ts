import { describe, expect, it } from 'vitest'

import browserExample from '../../public/config.example.json'
import tizenExample from '../../tizen/config.example.json'
import webosExample from '../../webos/config.example.json'
import {
  DEFAULT_PRESENTATION,
  PlaybackOrder,
  type PresentationSettings,
  Transition,
} from './presentation-settings.ts'
import {
  ConfigProblem,
  invalidConfig,
  MAX_SLIDESHOW_SECONDS,
  MIN_SLIDESHOW_SECONDS,
  parseRuntimeConfig,
  resolveImmichUrl,
  type RuntimeConfig,
  serverAddress,
} from './runtime-config.ts'

const IMMICH_URL = 'https://192.168.0.10:2283'
const API_KEY = 'read-only-key'
const DEFAULTS = DEFAULT_PRESENTATION

function withInterval(intervalSeconds: number): PresentationSettings {
  return { ...DEFAULT_PRESENTATION, intervalSeconds }
}

function configText(fields: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(fields)
}

describe('parseRuntimeConfig', () => {
  it('should read the Immich address and the API key', () => {
    const sut = parseRuntimeConfig(configText({ immichUrl: IMMICH_URL, apiKey: API_KEY }))

    expect(sut).toStrictEqual({
      isValid: true,
      config: {
        immichUrl: IMMICH_URL,
        apiKey: API_KEY,
        presentation: DEFAULTS,
      },
    })
  })

  it('should drop the blanks around the values and the slashes after the address', () => {
    const text = configText({ immichUrl: ` ${IMMICH_URL}// `, apiKey: ` ${API_KEY}\n` })

    expect(parseRuntimeConfig(text)).toStrictEqual({
      isValid: true,
      config: {
        immichUrl: IMMICH_URL,
        apiKey: API_KEY,
        presentation: DEFAULTS,
      },
    })
  })

  it.each([
    ['', ''],
    ['/', ''],
    [' / ', ''],
    ['/immich/', '/immich'],
  ])('should accept the address %j on the server of the page as %j', (immichUrl, expected) => {
    expect(parseRuntimeConfig(configText({ immichUrl, apiKey: API_KEY }))).toStrictEqual({
      isValid: true,
      config: { immichUrl: expected, apiKey: API_KEY, presentation: DEFAULTS },
    })
  })

  it.each([{}, { apiKey: null }, { apiKey: '' }, { apiKey: '  ' }])(
    'should leave the API key out when it is not given: %j',
    (fields) => {
      expect(parseRuntimeConfig(configText({ immichUrl: '', ...fields }))).toStrictEqual({
        isValid: true,
        config: { immichUrl: '', presentation: DEFAULTS },
      })
    },
  )

  it.each([
    [MIN_SLIDESHOW_SECONDS, 3],
    [12.4, 12],
    [12.5, 13],
    [60, 60],
    [MAX_SLIDESHOW_SECONDS, 60],
  ])(
    'should take the interval of the slideshow, %d seconds, as the default interval, %d',
    (slideshowSeconds, intervalSeconds) => {
      expect(parseRuntimeConfig(configText({ immichUrl: '', slideshowSeconds }))).toStrictEqual({
        isValid: true,
        config: { immichUrl: '', presentation: withInterval(intervalSeconds) },
      })
    },
  )

  it('should read the defaults of the presentation block over those of the app', () => {
    const presentation = { order: 'random', transition: 'ken-burns', showCaption: false }

    expect(parseRuntimeConfig(configText({ immichUrl: '', presentation }))).toStrictEqual({
      isValid: true,
      config: {
        immichUrl: '',
        presentation: {
          ...DEFAULTS,
          order: PlaybackOrder.Random,
          transition: Transition.KenBurns,
          shouldShowCaption: false,
        },
      },
    })
  })

  it('should prefer the interval of the presentation block to that of the slideshow', () => {
    const fields = { immichUrl: '', slideshowSeconds: 20, presentation: { intervalSeconds: 5 } }

    expect(parseRuntimeConfig(configText(fields))).toStrictEqual({
      isValid: true,
      config: { immichUrl: '', presentation: withInterval(5) },
    })
  })

  it('should keep the interval of the slideshow under a presentation block without one', () => {
    const fields = { immichUrl: '', slideshowSeconds: 20, presentation: { loop: false } }

    expect(parseRuntimeConfig(configText(fields))).toStrictEqual({
      isValid: true,
      config: { immichUrl: '', presentation: { ...withInterval(20), shouldLoop: false } },
    })
  })

  it.each([null, 'fade', [], { order: 'shuffled' }, { intervalSeconds: 90 }])(
    'should reject the presentation block %j',
    (presentation) => {
      expect(parseRuntimeConfig(configText({ immichUrl: '', presentation }))).toStrictEqual(
        invalidConfig(ConfigProblem.InvalidPresentation),
      )
    },
  )

  it.each([
    { folder: 'public', example: browserExample },
    { folder: 'webos', example: webosExample },
    { folder: 'tizen', example: tizenExample },
  ])('should read the example configuration of $folder', ({ example }) => {
    expect(parseRuntimeConfig(JSON.stringify(example))).toMatchObject({
      isValid: true,
      config: { presentation: DEFAULTS },
    })
  })

  it('should check the interval of the slideshow before the presentation block', () => {
    expect(
      parseRuntimeConfig(configText({ immichUrl: '', slideshowSeconds: 0, presentation: 1 })),
    ).toStrictEqual(invalidConfig(ConfigProblem.InvalidSlideshowSeconds))
  })

  it.each([MIN_SLIDESHOW_SECONDS - 0.5, MAX_SLIDESHOW_SECONDS + 1, 0, -8, '8', null, Number.NaN])(
    'should reject the interval of the slideshow %j',
    (slideshowSeconds) => {
      expect(parseRuntimeConfig(configText({ immichUrl: '', slideshowSeconds }))).toStrictEqual(
        invalidConfig(ConfigProblem.InvalidSlideshowSeconds),
      )
    },
  )

  it('should check the key before the interval of the slideshow', () => {
    expect(
      parseRuntimeConfig(configText({ immichUrl: '', apiKey: 42, slideshowSeconds: 0 })),
    ).toStrictEqual(invalidConfig(ConfigProblem.InvalidApiKey))
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
    null,
    42,
    'photos.example.com',
    'api',
    'photos/',
    '//photos.example.com',
    '/immich photos',
    '/?key=1',
    '/#top',
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

  it.each([42, true, ['key'], { key: 'key' }])('should reject the API key %j', (apiKey) => {
    expect(parseRuntimeConfig(configText({ immichUrl: IMMICH_URL, apiKey }))).toStrictEqual(
      invalidConfig(ConfigProblem.InvalidApiKey),
    )
  })

  it('should let through what JSON.parse throws besides a syntax error', () => {
    const notText = Symbol('not text') as unknown as string

    expect(() => parseRuntimeConfig(notText)).toThrow(TypeError)
  })

  it('should check the address before the key', () => {
    expect(parseRuntimeConfig(configText({ apiKey: 42 }))).toStrictEqual(
      invalidConfig(ConfigProblem.InvalidImmichUrl),
    )
  })
})

describe('serverAddress', () => {
  it.each([
    ['http://localhost:2283', 'localhost:2283'],
    ['HTTPS://photos.example.com/immich', 'photos.example.com/immich'],
  ])('should show %s as %s', (immichUrl, address) => {
    const config: RuntimeConfig = { immichUrl, apiKey: API_KEY, presentation: DEFAULTS }

    expect(serverAddress(config)).toBe(address)
  })
})

describe('resolveImmichUrl', () => {
  const PAGE_ORIGIN = 'http://tv.test:8080'

  it.each([
    ['', PAGE_ORIGIN],
    ['/immich', `${PAGE_ORIGIN}/immich`],
  ])('should place the address %j on the server of the page', (immichUrl, resolved) => {
    const config: RuntimeConfig = { immichUrl, presentation: DEFAULTS }

    expect(resolveImmichUrl(config, PAGE_ORIGIN)).toStrictEqual({
      immichUrl: resolved,
      presentation: DEFAULTS,
    })
  })

  it.each(['http://localhost:2283', 'HTTPS://photos.example.com/immich'])(
    'should keep the absolute address %s',
    (immichUrl) => {
      const sut: RuntimeConfig = { immichUrl, apiKey: API_KEY, presentation: DEFAULTS }

      expect(resolveImmichUrl(sut, PAGE_ORIGIN)).toBe(sut)
    },
  )
})
