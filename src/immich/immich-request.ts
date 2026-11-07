import { isHttpError, isMalformedResponseError } from '@immich/sdk'

import { LibraryFailure, PhotoLibraryError } from '../core/photo-library.ts'
import type { RuntimeConfig } from '../core/runtime-config.ts'
import { detailOf } from './immich-errors.ts'

const API_PATH = '/api'
const API_KEY_HEADER = 'x-api-key'
const HTTP_UNAUTHORIZED = 401
const HTTP_FORBIDDEN = 403
const HTTP_NOT_FOUND = 404

export interface ImmichLibraryOptions {
  readonly config: RuntimeConfig
  // How long a request may wait for the server before it counts as unreachable.
  readonly timeoutMs: number
}

export interface RequestOptions {
  readonly baseUrl: string
  readonly headers: Readonly<Record<string, string>>
  readonly signal: AbortSignal
}

export function apiUrl(config: RuntimeConfig): string {
  return `${config.immichUrl}${API_PATH}`
}

// One call to the server with the address and the key of the configuration, never the SDK's global
// defaults. Without a key in the configuration none is sent: the proxy in front of Immich adds it.
export async function request<T>(
  options: ImmichLibraryOptions,
  call: (request: RequestOptions) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, options.timeoutMs)
  try {
    return await call({
      baseUrl: apiUrl(options.config),
      headers: headersOf(options.config),
      signal: controller.signal,
    })
  } catch (error) {
    throw translate(error, options.config)
  } finally {
    clearTimeout(timer)
  }
}

// An answer that is not what Immich sends: the address leads somewhere else.
export function malformed(what: string): PhotoLibraryError {
  return new PhotoLibraryError(LibraryFailure.NotImmich, `Unexpected ${what} in the answer`)
}

function headersOf(config: RuntimeConfig): Readonly<Record<string, string>> {
  return config.apiKey === undefined ? {} : { [API_KEY_HEADER]: config.apiKey }
}

function translate(error: unknown, config: RuntimeConfig): unknown {
  const failure = failureOf(error, config)
  return failure === undefined ? error : new PhotoLibraryError(failure, detailOf(error))
}

function failureOf(error: unknown, config: RuntimeConfig): LibraryFailure | undefined {
  if (isHttpError(error)) {
    return failureOfStatus(error.status, config)
  }
  if (isMalformedResponseError(error)) {
    return LibraryFailure.NotImmich
  }
  return isNetworkFailure(error) ? LibraryFailure.Unreachable : undefined
}

// fetch rejects with a TypeError when the server cannot be reached (or refuses the origin), and
// with an AbortError when the timeout aborts it.
function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')
}

// A key the server refuses, or one without the permission to read: a new key fixes both.
function failureOfStatus(status: number, config: RuntimeConfig): LibraryFailure {
  if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) {
    return config.apiKey === undefined ? LibraryFailure.KeyMissing : LibraryFailure.KeyRejected
  }
  return status === HTTP_NOT_FOUND ? LibraryFailure.NotImmich : LibraryFailure.ServerError
}
