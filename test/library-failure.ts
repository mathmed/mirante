import { type LibraryFailure, PhotoLibraryError } from '../src/core/photo-library.ts'

// The failure a read of the photo library ends in; anything but a PhotoLibraryError fails the test.
export async function failureOf(promise: Promise<unknown>): Promise<LibraryFailure> {
  return (await libraryErrorOf(promise)).failure
}

// The error a read of the photo library ends in; anything but a PhotoLibraryError fails the test.
export async function libraryErrorOf(promise: Promise<unknown>): Promise<PhotoLibraryError> {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  )
  if (!(error instanceof PhotoLibraryError)) {
    throw new Error(`expected a PhotoLibraryError, got ${String(error)}`)
  }
  return error
}
