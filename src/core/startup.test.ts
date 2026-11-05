import { describe, expect, it } from 'vitest'

import { stubLibrary } from '../../test/library-stub.ts'
import {
  LibraryFailure,
  type PhotoLibrary,
  PhotoLibraryError,
  type ServerInfo,
} from './photo-library.ts'
import {
  ConfigProblem,
  type ConfigResult,
  invalidConfig,
  type RuntimeConfig,
} from './runtime-config.ts'
import { startUp, type StartupDependencies, StartupFailure, StartupStatus } from './startup.ts'

const CONFIG: RuntimeConfig = {
  immichUrl: 'http://immich.test',
  apiKey: 'key',
  slideshowSeconds: 5,
}
const SERVER: ServerInfo = { address: 'immich.test', version: '3.3.6' }
const PAGE_ORIGIN = 'http://tv.test'

interface Recorded {
  readonly dependencies: StartupDependencies
  readonly opened: RuntimeConfig[]
  readonly reported: unknown[]
}

function dependencies(config: ConfigResult, library: PhotoLibrary): Recorded {
  const opened: RuntimeConfig[] = []
  const reported: unknown[] = []
  return {
    opened,
    reported,
    dependencies: {
      loadConfig: async () => Promise.resolve(config),
      pageOrigin: PAGE_ORIGIN,
      openLibrary: (received) => {
        opened.push(received)
        return library
      },
      reportError: (error) => reported.push(error),
    },
  }
}

function libraryAnswering(server: Promise<ServerInfo>): PhotoLibrary {
  return stubLibrary({ describeServer: async () => server })
}

const VALID: ConfigResult = { isValid: true, config: CONFIG }

describe('startUp', () => {
  it('should connect to the server of the configuration', async () => {
    const library = libraryAnswering(Promise.resolve(SERVER))
    const sut = dependencies(VALID, library)

    expect(await startUp(sut.dependencies)).toStrictEqual({
      status: StartupStatus.Connected,
      session: { server: SERVER, library, slideshowSeconds: 5 },
    })
    expect(sut.opened).toStrictEqual([CONFIG])
    expect(sut.reported).toStrictEqual([])
  })

  it('should open the server of the page when the address is relative', async () => {
    const relative: RuntimeConfig = { immichUrl: '/immich', slideshowSeconds: 8 }
    const sut = dependencies(
      { isValid: true, config: relative },
      libraryAnswering(Promise.resolve(SERVER)),
    )

    await startUp(sut.dependencies)

    expect(sut.opened).toStrictEqual([{ immichUrl: `${PAGE_ORIGIN}/immich`, slideshowSeconds: 8 }])
  })

  it.each(Object.values(ConfigProblem))(
    'should fail with %s without opening the library',
    async (problem) => {
      const sut = dependencies(invalidConfig(problem), libraryAnswering(Promise.resolve(SERVER)))

      expect(await startUp(sut.dependencies)).toStrictEqual({
        status: StartupStatus.Failed,
        failure: problem,
      })
      expect(sut.opened).toStrictEqual([])
      expect(sut.reported).toStrictEqual([])
    },
  )

  it.each(Object.values(LibraryFailure))(
    'should fail with %s and log the error when the library does',
    async (failure) => {
      const error = new PhotoLibraryError(failure, 'detail for the log')
      const sut = dependencies(VALID, libraryAnswering(Promise.reject(error)))

      expect(await startUp(sut.dependencies)).toStrictEqual({
        status: StartupStatus.Failed,
        failure,
      })
      expect(sut.reported).toStrictEqual([error])
    },
  )

  it('should fail as unexpected and log any other error', async () => {
    const error = new TypeError('bug')
    const sut = dependencies(VALID, libraryAnswering(Promise.reject(error)))

    expect(await startUp(sut.dependencies)).toStrictEqual({
      status: StartupStatus.Failed,
      failure: StartupFailure.Unexpected,
    })
    expect(sut.reported).toStrictEqual([error])
  })

  it('should fail as unexpected when the configuration cannot be loaded', async () => {
    const error = new Error('loader bug')
    const sut = dependencies(VALID, libraryAnswering(Promise.resolve(SERVER)))
    const failing: StartupDependencies = {
      ...sut.dependencies,
      loadConfig: async () => Promise.reject(error),
    }

    expect(await startUp(failing)).toStrictEqual({
      status: StartupStatus.Failed,
      failure: StartupFailure.Unexpected,
    })
    expect(sut.reported).toStrictEqual([error])
  })
})

describe('PhotoLibraryError', () => {
  it('should carry the failure and name itself in the logs', () => {
    const sut = new PhotoLibraryError(LibraryFailure.NotImmich, 'HTML instead of JSON')

    expect(sut).toBeInstanceOf(Error)
    expect(sut.failure).toBe(LibraryFailure.NotImmich)
    expect(sut.name).toBe('PhotoLibraryError')
    expect(sut.message).toBe('HTML instead of JSON')
  })
})
