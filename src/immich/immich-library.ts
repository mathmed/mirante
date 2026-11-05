import {
  getServerVersion,
  isHttpError,
  isMalformedResponseError,
  type ServerVersionResponseDto,
  validateAccessToken,
} from '@immich/sdk'

import {
  LibraryFailure,
  type PhotoLibrary,
  PhotoLibraryError,
  type ServerInfo,
} from '../core/photo-library.ts'
import { type RuntimeConfig, serverAddress } from '../core/runtime-config.ts'

const API_PATH = '/api'
const HTTP_UNAUTHORIZED = 401
const HTTP_NOT_FOUND = 404

export interface ImmichLibraryOptions {
  readonly config: RuntimeConfig
  // How long a request may wait for the server before it counts as unreachable.
  readonly timeoutMs: number
}

interface RequestOptions {
  readonly baseUrl: string
  readonly headers: Readonly<Record<string, string>>
  readonly signal: AbortSignal
}

// Read only: the app never writes to Immich. Each call gets the address and the key of the
// configuration instead of the SDK's global defaults.
export function createImmichLibrary(options: ImmichLibraryOptions): PhotoLibrary {
  return { describeServer: async () => describeServer(options) }
}

async function describeServer(options: ImmichLibraryOptions): Promise<ServerInfo> {
  const version = await withTimeout(options, fetchVersion)
  return { address: serverAddress(options.config), version: formatVersion(version) }
}

async function fetchVersion(request: RequestOptions): Promise<ServerVersionResponseDto> {
  const version = await getServerVersion(request)
  // The version is public: only an authenticated call proves the key. Validating a token changes
  // nothing on the server and needs no permission, so a read-only key passes.
  await validateAccessToken(request)
  return version
}

async function withTimeout<T>(
  { config, timeoutMs }: ImmichLibraryOptions,
  call: (request: RequestOptions) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, timeoutMs)
  const request = {
    baseUrl: `${config.immichUrl}${API_PATH}`,
    headers: { 'x-api-key': config.apiKey },
    signal: controller.signal,
  }
  try {
    return await call(request)
  } catch (error) {
    throw translate(error)
  } finally {
    clearTimeout(timer)
  }
}

function formatVersion(version: ServerVersionResponseDto): string {
  const parts = [version.major, version.minor, version.patch]
  if (!parts.every((part) => Number.isInteger(part))) {
    throw new PhotoLibraryError(LibraryFailure.NotImmich, 'Unexpected version format')
  }
  return parts.join('.')
}

function translate(error: unknown): unknown {
  const failure = failureOf(error)
  return failure === undefined ? error : new PhotoLibraryError(failure, String(error))
}

function failureOf(error: unknown): LibraryFailure | undefined {
  if (isHttpError(error)) {
    return failureOfStatus(error.status)
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

function failureOfStatus(status: number): LibraryFailure {
  if (status === HTTP_UNAUTHORIZED) {
    return LibraryFailure.KeyRejected
  }
  return status === HTTP_NOT_FOUND ? LibraryFailure.NotImmich : LibraryFailure.ServerError
}
