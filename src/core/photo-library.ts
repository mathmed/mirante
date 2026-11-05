// What the app reads from the photo server, whatever serves it. src/immich implements it with the
// Immich SDK; the rest of the app only knows this interface and its domain types.
export interface ServerInfo {
  readonly address: string
  readonly version: string
}

export interface PhotoLibrary {
  readonly describeServer: () => Promise<ServerInfo>
}

export const LibraryFailure = {
  Unreachable: 'server-unreachable',
  KeyRejected: 'api-key-rejected',
  NotImmich: 'not-immich',
  ServerError: 'server-error',
} as const

export type LibraryFailure = (typeof LibraryFailure)[keyof typeof LibraryFailure]

// The message is for the logs; people see the text the UI writes for the failure.
export class PhotoLibraryError extends Error {
  override readonly name = 'PhotoLibraryError'
  readonly failure: LibraryFailure

  constructor(failure: LibraryFailure, message: string) {
    super(message)
    this.failure = failure
  }
}
