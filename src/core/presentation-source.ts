import type { TimelineYear } from './gallery.ts'
import type { Album, Photo, PhotoLibrary, TimelineMonth } from './photo-library.ts'
import { PlaybackOrder } from './presentation-settings.ts'

// What a presentation shows: an album, a month or a year of the timeline, or the whole library.
export const SourceKind = {
  Album: 'album',
  Month: 'month',
  Year: 'year',
  Library: 'library',
} as const

export type SourceKind = (typeof SourceKind)[keyof typeof SourceKind]

export type PresentationSource =
  | { readonly kind: typeof SourceKind.Album; readonly album: Album }
  | { readonly kind: typeof SourceKind.Library }
  | { readonly kind: typeof SourceKind.Month; readonly month: TimelineMonth }
  | { readonly kind: typeof SourceKind.Year; readonly year: TimelineYear }

// The whole library comes a few photos at a time, drawn at random by the server, a new draw for
// each round: a TV never holds the list of every photo.
export const LIBRARY_ROUND_SIZE = 200

export const LIBRARY_SOURCE: PresentationSource = { kind: SourceKind.Library }

// The photos of one round of the source.
export async function loadSourcePhotos(
  library: PhotoLibrary,
  source: PresentationSource,
): Promise<readonly Photo[]> {
  switch (source.kind) {
    case SourceKind.Album:
      return library.listAlbumPhotos(source.album)
    case SourceKind.Month:
      return library.listMonthPhotos(source.month)
    case SourceKind.Year:
      return loadYearPhotos(library, source.year)
    default:
      return library.listRandomPhotos(LIBRARY_ROUND_SIZE)
  }
}

// The library is always random: its rounds are random draws.
export function orderOf(source: PresentationSource, order: PlaybackOrder): PlaybackOrder {
  return source.kind === SourceKind.Library ? PlaybackOrder.Random : order
}

// Each round of the library is a new draw from the server; the other sources play the same photos.
export function isDrawnEachRound(source: PresentationSource): boolean {
  return source.kind === SourceKind.Library
}

// A new draw of the library for a later round. When the draw fails or comes back empty, the photos
// given play again, and the error goes to the log: the presentation never stops on it.
export async function drawRound(
  library: PhotoLibrary,
  previous: readonly Photo[],
  reportError: (error: unknown) => void,
): Promise<readonly Photo[]> {
  try {
    const photos = await library.listRandomPhotos(LIBRARY_ROUND_SIZE)
    return photos.length === 0 ? previous : photos
  } catch (error) {
    reportError(error)
    return previous
  }
}

async function loadYearPhotos(
  library: PhotoLibrary,
  year: TimelineYear,
): Promise<readonly Photo[]> {
  const months = await Promise.all(year.months.map(async (month) => library.listMonthPhotos(month)))
  return ([] as Photo[]).concat(...months)
}
