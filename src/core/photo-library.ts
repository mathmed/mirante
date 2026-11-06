// What the app reads from the photo server, whatever serves it. src/immich implements it with the
// Immich SDK; the rest of the app only knows this interface and its domain types.
export interface ServerInfo {
  readonly address: string
  readonly version: string
}

// The day a photo was taken, in the time zone where it was taken: the date Immich shows.
export interface PhotoDate {
  readonly year: number
  // 1 to 12.
  readonly month: number
  readonly day: number
}

// Only photos: the library leaves videos and any other kind of file out.
export interface Photo {
  readonly id: string
  // The instant it was taken, in milliseconds since the epoch: what photos are sorted by.
  readonly takenAtMs: number
  readonly date: PhotoDate
}

export const PhotoOrder = {
  OldestFirst: 'oldest-first',
  NewestFirst: 'newest-first',
} as const

export type PhotoOrder = (typeof PhotoOrder)[keyof typeof PhotoOrder]

export interface Album {
  readonly id: string
  readonly name: string
  // As the server counts them.
  readonly photoCount: number
  readonly coverPhotoId?: string
  // The order the owner chose for the album on the server.
  readonly order: PhotoOrder
  // When its most recent photo was taken; absent for an empty album.
  readonly lastPhotoAtMs?: number
}

export interface TimelineMonth {
  // The server's own name for the month, handed back to it to list the month's photos.
  readonly key: string
  readonly year: number
  // 1 to 12.
  readonly month: number
  // As the server counts them.
  readonly photoCount: number
}

// Never the original file: a TV only needs the small image of the grids and the larger preview.
export const ImageSize = {
  Thumbnail: 'thumbnail',
  Preview: 'preview',
} as const

export type ImageSize = (typeof ImageSize)[keyof typeof ImageSize]

export interface PhotoLibrary {
  readonly describeServer: () => Promise<ServerInfo>
  readonly listAlbums: () => Promise<readonly Album[]>
  readonly listAlbumPhotos: (album: Album) => Promise<readonly Photo[]>
  readonly listTimelineMonths: () => Promise<readonly TimelineMonth[]>
  readonly listMonthPhotos: (month: TimelineMonth) => Promise<readonly Photo[]>
  // Up to this many photos of the timeline, drawn at random by the server.
  readonly listRandomPhotos: (count: number) => Promise<readonly Photo[]>
  // The caption written for the photo in the library (its description); none when it has none.
  readonly readCaption: (photoId: string) => Promise<string | undefined>
  // The address an <img> loads the photo from.
  readonly imageUrl: (photoId: string, size: ImageSize) => string
}

export const LibraryFailure = {
  Unreachable: 'server-unreachable',
  KeyRejected: 'api-key-rejected',
  KeyMissing: 'api-key-missing',
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
