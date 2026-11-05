import {
  type Album,
  type Photo,
  type PhotoLibrary,
  PhotoOrder,
  type TimelineMonth,
} from './photo-library.ts'

export interface TimelineYear {
  readonly year: number
  // In the order of the calendar.
  readonly months: readonly TimelineMonth[]
}

// The order the screens show, whatever order the server answers in. Every comparison ends on the id:
// Chromium 68 does not sort stably, and the same library must always look the same.

// The albums with the most recent photos first, as Immich lists them; empty albums last.
export async function loadAlbums(library: PhotoLibrary): Promise<readonly Album[]> {
  return sortAlbums(await library.listAlbums())
}

// In the order the owner chose for the album.
export async function loadAlbumPhotos(
  library: PhotoLibrary,
  album: Album,
): Promise<readonly Photo[]> {
  return sortPhotos(await library.listAlbumPhotos(album), album.order)
}

// The most recent years first; a month reads like a story, from its first photo to its last.
export async function loadTimeline(library: PhotoLibrary): Promise<readonly TimelineYear[]> {
  return timelineYears(await library.listTimelineMonths())
}

export async function loadMonthPhotos(
  library: PhotoLibrary,
  month: TimelineMonth,
): Promise<readonly Photo[]> {
  return sortPhotos(await library.listMonthPhotos(month), PhotoOrder.OldestFirst)
}

// The photo behind the start screen: the cover of the first album that has one, in the order the
// albums screen shows them (the most recent first); none for a library without covers.
export function backdropPhotoId(albums: readonly Album[]): string | undefined {
  return albums.find((album) => album.coverPhotoId !== undefined)?.coverPhotoId
}

export function sortAlbums(albums: readonly Album[]): readonly Album[] {
  const sorted = [...albums]
  sorted.sort((first, second) =>
    thenBy(compare(lastPhotoOf(second), lastPhotoOf(first)), compare(first.id, second.id)),
  )
  return sorted
}

export function sortPhotos(photos: readonly Photo[], order: PhotoOrder): readonly Photo[] {
  const sign = order === PhotoOrder.OldestFirst ? 1 : -1
  const sorted = [...photos]
  sorted.sort((first, second) =>
    thenBy(sign * compare(first.takenAtMs, second.takenAtMs), compare(first.id, second.id)),
  )
  return sorted
}

export function timelineYears(months: readonly TimelineMonth[]): readonly TimelineYear[] {
  const byYear = new Map<number, TimelineMonth[]>()
  for (const month of months) {
    const yearMonths = byYear.get(month.year) ?? []
    yearMonths.push(month)
    byYear.set(month.year, yearMonths)
  }
  const years = [...byYear.entries()]
  years.sort(([earlier], [later]) => compare(later, earlier))
  return years.map(([year, yearMonths]) => ({ year, months: calendarOrder(yearMonths) }))
}

function calendarOrder(months: readonly TimelineMonth[]): readonly TimelineMonth[] {
  const sorted = [...months]
  sorted.sort((first, second) =>
    thenBy(compare(first.month, second.month), compare(first.key, second.key)),
  )
  return sorted
}

// An empty album has no last photo: it sorts before any moment, so after every other album.
function lastPhotoOf(album: Album): number {
  return album.lastPhotoAtMs ?? Number.NEGATIVE_INFINITY
}

function thenBy(comparison: number, tieBreak: number): number {
  return comparison === 0 ? tieBreak : comparison
}

function compare<T extends number | string>(first: T, second: T): number {
  if (first < second) {
    return -1
  }
  return first > second ? 1 : 0
}
