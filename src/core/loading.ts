import { LibraryFailure, PhotoLibraryError } from './photo-library.ts'

export const LoadFailure = {
  ...LibraryFailure,
  Unexpected: 'unexpected',
} as const

export type LoadFailure = (typeof LoadFailure)[keyof typeof LoadFailure]

export const LoadStatus = {
  Loading: 'loading',
  Loaded: 'loaded',
  Failed: 'failed',
} as const

export type LoadOutcome<T> =
  | { readonly status: typeof LoadStatus.Loaded; readonly value: T }
  | { readonly status: typeof LoadStatus.Failed; readonly failure: LoadFailure }

export type LoadState<T> = LoadOutcome<T> | { readonly status: typeof LoadStatus.Loading }

export const LOADING: { readonly status: typeof LoadStatus.Loading } = {
  status: LoadStatus.Loading,
}

// What the screen explains: the failure of the library, or "unexpected" for anything else.
export function loadFailureOf(error: unknown): LoadFailure {
  return error instanceof PhotoLibraryError ? error.failure : LoadFailure.Unexpected
}

// Every error becomes an outcome the screen can explain; the error behind it goes to the log.
export async function runLoad<T>(
  task: () => Promise<T>,
  reportError: (error: unknown) => void,
): Promise<LoadOutcome<T>> {
  try {
    return { status: LoadStatus.Loaded, value: await task() }
  } catch (error) {
    reportError(error)
    return { status: LoadStatus.Failed, failure: loadFailureOf(error) }
  }
}
