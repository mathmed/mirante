import { describe, expect, it } from 'vitest'

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

const CONFIG: RuntimeConfig = { immichUrl: 'http://immich.test', apiKey: 'key' }
const SERVER: ServerInfo = { address: 'immich.test', version: '3.3.6' }

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
      openLibrary: (received) => {
        opened.push(received)
        return library
      },
      reportError: (error) => reported.push(error),
    },
  }
}

function libraryAnswering(server: Promise<ServerInfo>): PhotoLibrary {
  return { describeServer: async () => server }
}

const VALID: ConfigResult = { isValid: true, config: CONFIG }

describe('startUp', () => {
  it('should connect to the server of the configuration', async () => {
    const sut = dependencies(VALID, libraryAnswering(Promise.resolve(SERVER)))

    expect(await startUp(sut.dependencies)).toStrictEqual({
      status: StartupStatus.Connected,
      server: SERVER,
    })
    expect(sut.opened).toStrictEqual([CONFIG])
    expect(sut.reported).toStrictEqual([])
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
