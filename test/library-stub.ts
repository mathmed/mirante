import type {
  Album,
  Photo,
  PhotoLibrary,
  ServerInfo,
  TimelineMonth,
} from '../src/core/photo-library.ts'

// A photo library for the tests of the core and of the components, which run without a server:
// every read the test does not give fails it. The adapter itself is tested against the fake server.
export function stubLibrary(reads: Partial<PhotoLibrary>): PhotoLibrary {
  const unexpected = async (): Promise<never> => Promise.reject(new Error('unexpected read'))
  return {
    describeServer: unexpected,
    listAlbums: unexpected,
    listAlbumPhotos: unexpected,
    listTimelineMonths: unexpected,
    listMonthPhotos: unexpected,
    listRandomPhotos: unexpected,
    readCaption: unexpected,
    imageUrl: (photoId, size) => `https://images.test/${size}/${photoId}`,
    ...reads,
  }
}

export interface MemoryLibrary {
  readonly server: ServerInfo
  readonly albums: readonly Album[]
  // By album id, and by month key.
  readonly albumPhotos: ReadonlyMap<string, readonly Photo[]>
  readonly months: readonly TimelineMonth[]
  readonly monthPhotos: ReadonlyMap<string, readonly Photo[]>
  // By photo id; a photo without one has no caption.
  readonly captions?: ReadonlyMap<string, string>
}

// A library that answers from memory, at once.
export function memoryLibrary(data: MemoryLibrary): PhotoLibrary {
  return stubLibrary({
    describeServer: async () => Promise.resolve(data.server),
    listAlbums: async () => Promise.resolve(data.albums),
    listAlbumPhotos: async (album) => Promise.resolve(data.albumPhotos.get(album.id) ?? []),
    listTimelineMonths: async () => Promise.resolve(data.months),
    listMonthPhotos: async (month) => Promise.resolve(data.monthPhotos.get(month.key) ?? []),
    // "At random": the first photos of the months, in the order of the map.
    listRandomPhotos: async (count) =>
      Promise.resolve(([] as Photo[]).concat(...data.monthPhotos.values()).slice(0, count)),
    readCaption: async (photoId) => Promise.resolve(data.captions?.get(photoId)),
  })
}

interface Month {
  readonly year: number
  readonly month: number
}

const MARCH_2024: Month = { year: 2024, month: 3 }

const DAYS_IN_ANY_MONTH = 28
const PHOTO_RATIO = 1.5

// Photos of a month, in the order they were taken, one a day (and around again after the 28th),
// named <prefix>-1, <prefix>-2...
export function photos(
  prefix: string,
  count: number,
  { year, month } = MARCH_2024,
): readonly Photo[] {
  return [...Array(count).keys()].map((index) => ({
    id: `${prefix}-${String(index + 1)}`,
    takenAtMs: Date.UTC(year, month - 1, 1) + index,
    date: { year, month, day: (index % DAYS_IN_ANY_MONTH) + 1 },
    aspectRatio: PHOTO_RATIO,
  }))
}
