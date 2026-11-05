import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { API_KEY, fakeServer, IMMICH_URL, serveImmich } from '../../test/fake-immich.ts'
import { LibraryFailure, type PhotoLibrary, PhotoLibraryError } from '../core/photo-library.ts'
import { createImmichLibrary } from './immich-library.ts'

// Generous, so that a slow machine never turns an answer into a timeout; the timeout test uses its own.
const TIMEOUT_MS = 5000
const SHORT_TIMEOUT_MS = 50
const VERSION_URL = `${IMMICH_URL}/api/server/version`
const JSON_CONTENT = { 'Content-Type': 'application/json' }

function library(apiKey = API_KEY, timeoutMs = TIMEOUT_MS): PhotoLibrary {
  return createImmichLibrary({ config: { immichUrl: IMMICH_URL, apiKey }, timeoutMs })
}

async function failureOf(promise: Promise<unknown>): Promise<LibraryFailure> {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  )
  if (!(error instanceof PhotoLibraryError)) {
    throw new Error(`expected a PhotoLibraryError, got ${String(error)}`)
  }
  return error.failure
}

describe('createImmichLibrary', () => {
  it('should describe the server with its address and version', async () => {
    serveImmich()

    expect(await library().describeServer()).toStrictEqual({
      address: 'immich.test',
      version: '3.3.6',
    })
  })

  it('should send the API key of the configuration', async () => {
    serveImmich()

    expect(await failureOf(library('another-key').describeServer())).toBe(
      LibraryFailure.KeyRejected,
    )
  })

  it('should fail as unreachable when the server does not answer in time', async () => {
    fakeServer.use(http.get(VERSION_URL, async () => delay('infinite')))

    expect(await failureOf(library(API_KEY, SHORT_TIMEOUT_MS).describeServer())).toBe(
      LibraryFailure.Unreachable,
    )
  })

  it('should fail as unreachable when the network fails', async () => {
    fakeServer.use(http.get(VERSION_URL, () => HttpResponse.error()))

    expect(await failureOf(library().describeServer())).toBe(LibraryFailure.Unreachable)
  })

  it('should fail as not Immich when the address answers with a page', async () => {
    fakeServer.use(http.get(VERSION_URL, () => HttpResponse.html('<html></html>')))

    expect(await failureOf(library().describeServer())).toBe(LibraryFailure.NotImmich)
  })

  it('should fail as not Immich when the address has no Immich API', async () => {
    fakeServer.use(http.get(VERSION_URL, () => HttpResponse.json({}, { status: 404 })))

    expect(await failureOf(library().describeServer())).toBe(LibraryFailure.NotImmich)
  })

  it('should fail as not Immich when the version is not one', async () => {
    serveImmich()
    fakeServer.use(http.get(VERSION_URL, () => HttpResponse.json({ major: '3', minor: 1 })))

    expect(await failureOf(library().describeServer())).toBe(LibraryFailure.NotImmich)
  })

  it('should fail as a server error on any other status', async () => {
    fakeServer.use(http.get(VERSION_URL, () => HttpResponse.json({}, { status: 503 })))

    expect(await failureOf(library().describeServer())).toBe(LibraryFailure.ServerError)
  })

  it('should let an error it does not know through untouched', async () => {
    fakeServer.use(http.get(VERSION_URL, () => new HttpResponse('{', { headers: JSON_CONTENT })))

    await expect(library().describeServer()).rejects.toBeInstanceOf(SyntaxError)
  })
})
