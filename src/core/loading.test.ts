import { describe, expect, it } from 'vitest'

import { LoadFailure, loadFailureOf, LoadStatus, runLoad } from './loading.ts'
import { LibraryFailure, PhotoLibraryError } from './photo-library.ts'

describe('runLoad', () => {
  it('should give the value of the task', async () => {
    const reported: unknown[] = []

    const sut = await runLoad(
      async () => Promise.resolve([1, 2]),
      (error) => reported.push(error),
    )

    expect(sut).toStrictEqual({ status: LoadStatus.Loaded, value: [1, 2] })
    expect(reported).toStrictEqual([])
  })

  it.each(Object.values(LibraryFailure))(
    'should fail with %s and log the error of the library',
    async (failure) => {
      const reported: unknown[] = []
      const error = new PhotoLibraryError(failure, 'detail for the log')

      const sut = await runLoad(
        async () => Promise.reject(error),
        (logged) => reported.push(logged),
      )

      expect(sut).toStrictEqual({ status: LoadStatus.Failed, failure })
      expect(reported).toStrictEqual([error])
    },
  )

  it('should fail as unexpected and log any other error', async () => {
    const reported: unknown[] = []
    const error = new RangeError('bug')

    const sut = await runLoad(
      async () => Promise.reject(error),
      (logged) => reported.push(logged),
    )

    expect(sut).toStrictEqual({ status: LoadStatus.Failed, failure: LoadFailure.Unexpected })
    expect(reported).toStrictEqual([error])
  })
})

describe('loadFailureOf', () => {
  it('should read the failure of a library error', () => {
    expect(loadFailureOf(new PhotoLibraryError(LibraryFailure.KeyMissing, 'no key'))).toBe(
      LibraryFailure.KeyMissing,
    )
  })

  it.each([new Error('bug'), 'text', undefined])('should call %j unexpected', (error) => {
    expect(loadFailureOf(error)).toBe(LoadFailure.Unexpected)
  })
})
