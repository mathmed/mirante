import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import {
  CONFIG_URL,
  fakeServer,
  serveConfig,
  serveConfigStatus,
  VALID_CONFIG,
} from '../../test/fake-immich.ts'
import { DEFAULT_PRESENTATION } from '../core/presentation-settings.ts'
import { ConfigProblem, invalidConfig } from '../core/runtime-config.ts'
import { configFrom, readConfigFile } from './config-file.ts'

const VALID_TEXT = JSON.stringify(VALID_CONFIG)
const PARSED_CONFIG = { ...VALID_CONFIG, presentation: DEFAULT_PRESENTATION }

describe('readConfigFile', () => {
  it('should read the configuration next to the page', async () => {
    serveConfig(VALID_CONFIG)

    expect(await readConfigFile(CONFIG_URL)).toStrictEqual({ isValid: true, config: PARSED_CONFIG })
  })

  it('should ask for a fresh copy, so that an edited file is read again', async () => {
    const cacheControl: (string | null)[] = []
    fakeServer.use(
      http.get(CONFIG_URL, ({ request }) => {
        cacheControl.push(request.headers.get('Cache-Control'))
        return HttpResponse.json(VALID_CONFIG)
      }),
    )

    await readConfigFile(CONFIG_URL)

    expect(cacheControl).toStrictEqual(['no-cache'])
  })

  it('should report a missing file', async () => {
    serveConfigStatus(404)

    expect(await readConfigFile(CONFIG_URL)).toStrictEqual(invalidConfig(ConfigProblem.Missing))
  })

  it('should report a missing file when the server answers with its page instead', async () => {
    fakeServer.use(http.get(CONFIG_URL, () => HttpResponse.html('<!doctype html><html></html>')))

    expect(await readConfigFile(CONFIG_URL)).toStrictEqual(invalidConfig(ConfigProblem.Missing))
  })

  it('should report a missing file when the request fails', async () => {
    fakeServer.use(http.get(CONFIG_URL, () => HttpResponse.error()))

    expect(await readConfigFile(CONFIG_URL)).toStrictEqual(invalidConfig(ConfigProblem.Missing))
  })

  it('should report a file the server could not give', async () => {
    serveConfigStatus(500)

    expect(await readConfigFile(CONFIG_URL)).toStrictEqual(invalidConfig(ConfigProblem.Unreadable))
  })

  it('should report a file that is not JSON', async () => {
    serveConfigStatus(200, 'immichUrl=http://immich.test')

    expect(await readConfigFile(CONFIG_URL)).toStrictEqual(invalidConfig(ConfigProblem.Malformed))
  })
})

describe('configFrom', () => {
  it('should read a local file, which answers with status 0', () => {
    expect(configFrom({ status: 0, text: VALID_TEXT, contentType: null })).toStrictEqual({
      isValid: true,
      config: PARSED_CONFIG,
    })
  })

  it('should report an empty local answer as a missing file', () => {
    expect(configFrom({ status: 0, text: '', contentType: null })).toStrictEqual(
      invalidConfig(ConfigProblem.Missing),
    )
  })

  it('should report an empty file served over HTTP as malformed', () => {
    expect(configFrom({ status: 200, text: '', contentType: 'application/json' })).toStrictEqual(
      invalidConfig(ConfigProblem.Malformed),
    )
  })

  it.each([201, 304, 403])('should report status %i as unreadable', (status) => {
    expect(configFrom({ status, text: VALID_TEXT, contentType: 'application/json' })).toStrictEqual(
      invalidConfig(ConfigProblem.Unreadable),
    )
  })
})
