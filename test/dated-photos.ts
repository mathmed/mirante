import {
  type DateSearch,
  type Photo,
  type PhotoDate,
  PhotoOrder,
} from '../src/core/photo-library.ts'

const NOON_HOURS = 12
const DAY_PARTS = /^(\d{4})-(\d{2})-(\d{2})$/

// A photo taken at noon of a day ("2023-11-07"), named after it unless named otherwise.
export function photoOn(day: string, id = day): Photo {
  const date = dateOf(day)
  return {
    id,
    takenAtMs: Date.UTC(date.year, date.month - 1, date.day, NOON_HOURS),
    date,
    aspectRatio: 1,
  }
}

export function dateOf(day: string): PhotoDate {
  const parts = DAY_PARTS.exec(day)
  if (parts === null) {
    throw new Error(`Not a day: ${day}`)
  }
  return { year: Number(parts[1]), month: Number(parts[2]), day: Number(parts[3]) }
}

// What a library answers to a search by date: the photos of those days, the nearest to the start
// first, up to the count asked for.
export function photosTaken(photos: readonly Photo[], search: DateSearch): readonly Photo[] {
  const from = Date.UTC(search.from.year, search.from.month - 1, search.from.day)
  const to = Date.UTC(search.to.year, search.to.month - 1, search.to.day)
  const found = photos.filter((photo) => {
    const day = Date.UTC(photo.date.year, photo.date.month - 1, photo.date.day)
    return day >= from && day <= to
  })
  const sign = search.order === PhotoOrder.OldestFirst ? 1 : -1
  return [...found]
    .sort((first, second) => sign * (first.takenAtMs - second.takenAtMs))
    .slice(0, search.count)
}
