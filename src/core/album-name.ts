import { type Album, type Photo, type PhotoDate, PhotoOrder } from './photo-library.ts'

// The name of an album, as typed: without the blanks around it, and never longer than this.
export const MAX_ALBUM_NAME_LENGTH = 100
const PROVISIONAL_PREFIX = 'new-album-'
export const SuggestionKind = { Month: 'month', Day: 'day' } as const

// What a new album is called unless a name is typed: the month of its photos when they all share
// one, else the day it is created.
export type NameSuggestion =
  | { readonly kind: typeof SuggestionKind.Month; readonly year: number; readonly month: number }
  | { readonly kind: typeof SuggestionKind.Day; readonly date: PhotoDate }

// Undefined for a name of blanks alone, which the album cannot take.
export function albumNameOf(text: string): string | undefined {
  const name = text.trim().slice(0, MAX_ALBUM_NAME_LENGTH).trim()
  return name === '' ? undefined : name
}

export function suggestedName(photos: readonly Photo[], today: PhotoDate): NameSuggestion {
  const [first] = photos
  const isOneMonth =
    first !== undefined &&
    photos.every(({ date }) => date.year === first.date.year && date.month === first.date.month)
  return isOneMonth
    ? { kind: SuggestionKind.Month, year: first.date.year, month: first.date.month }
    : { kind: SuggestionKind.Day, date: today }
}

// The album the screens show while the server creates it: its photos counted, the first one as its
// cover, sorted by its most recent photo like the others. Its id is provisional, unique in the visit.
export function provisionalAlbum(name: string, photos: readonly Photo[], serial: number): Album {
  const album: Album = {
    id: `${PROVISIONAL_PREFIX}${String(serial)}`,
    name,
    photoCount: photos.length,
    order: PhotoOrder.NewestFirst,
  }
  const [first] = photos
  if (first === undefined) {
    return album
  }
  const lastPhotoAtMs = Math.max(...photos.map((photo) => photo.takenAtMs))
  return { ...album, coverPhotoId: first.id, lastPhotoAtMs }
}

// Nothing can be done to an album before the server has created it.
export function isProvisional(album: Album): boolean {
  return album.id.startsWith(PROVISIONAL_PREFIX)
}
