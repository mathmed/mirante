import { addDays, dayNumber, isSameDayOfYear, sameDayIn } from './calendar.ts'
import {
  type DateSearch,
  type Photo,
  type PhotoDate,
  type PhotoLibrary,
  PhotoOrder,
  type TimelineMonth,
} from './photo-library.ts'
import { shuffled, textSeed } from './shuffle.ts'

// The photos of today's day in the years before this one; without any, those of the nearest day
// to it, a day before or after, up to this far.
const WINDOW_DAYS = 30
// The photos a visit takes turns with, at most: the TV keeps little memory.
export const MEMORY_LIMIT = 10
// What each search asks for: enough for the photos of the nearest day, little for the TV to read.
const PHOTOS_PER_SEARCH = 20
const MONTHS_PER_YEAR = 12

// A photo of a past year near today's day of the year.
export interface Memory {
  readonly photoId: string
  // The years between today and the year of the day it is near: 1 or more.
  readonly yearsAgo: number
  // The date where it was taken, as Immich shows it.
  readonly date: PhotoDate
  // Taken on today's month and day; else its date is named.
  readonly isSameDay: boolean
}

interface Placed {
  readonly photo: Photo
  readonly yearsAgo: number
  // The days from today's day, in the year it is near, to the date it was taken.
  readonly offset: number
}

export const Side = { Before: 'before', After: 'after' } as const
export type Side = (typeof Side)[keyof typeof Side]

// The photos of today's day in past years, or of the nearest day that has some: first the days up
// to today's in each year (the newest first, so the nearest), and only when none falls on today's
// the days after it. The months of the timeline leave out the years with nothing near.
export async function loadMemories(
  library: PhotoLibrary,
  today: PhotoDate,
): Promise<readonly Memory[]> {
  const months = await library.listTimelineMonths()
  const before = await searchSide(library, searchesOf(months, today, Side.Before))
  if (placedOf(before, today).some((placed) => placed.offset === 0)) {
    return pickMemories(before, today)
  }
  const after = await searchSide(library, searchesOf(months, today, Side.After))
  return pickMemories([...before, ...after], today)
}

// The photos of the nearest day to today's, in a past year, a day before winning a tie with a day
// after; in the same order all day long (and a different one the next day), at most MEMORY_LIMIT.
export function pickMemories(photos: readonly Photo[], today: PhotoDate): readonly Memory[] {
  const placed = placedOf(photos, today)
  const nearest = nearestOffset(placed)
  const chosen = placed.filter((candidate) => candidate.offset === nearest)
  chosen.sort((first, second) => first.photo.id.localeCompare(second.photo.id))
  return shuffled(chosen, textSeed(dateKey(today)))
    .slice(0, MEMORY_LIMIT)
    .map((candidate) => memoryOf(candidate, today))
}

// The searches of one side of today's day, in every past year whose months hold photos near it.
export function searchesOf(
  months: readonly TimelineMonth[],
  today: PhotoDate,
  side: Side,
): readonly DateSearch[] {
  return candidateYears(months, today)
    .map((year) => searchOf(sameDayIn(today, year), side))
    .filter((search) => hasPhotosAround(months, search))
}

async function searchSide(
  library: PhotoLibrary,
  searches: readonly DateSearch[],
): Promise<readonly Photo[]> {
  const found = await Promise.all(searches.map(async (search) => library.listPhotosTaken(search)))
  return ([] as Photo[]).concat(...found)
}

function searchOf(day: PhotoDate, side: Side): DateSearch {
  if (side === Side.Before) {
    const from = addDays(day, -WINDOW_DAYS)
    return { from, to: day, order: PhotoOrder.NewestFirst, count: PHOTOS_PER_SEARCH }
  }
  const from = addDays(day, 1)
  const to = addDays(day, WINDOW_DAYS)
  return { from, to, order: PhotoOrder.OldestFirst, count: PHOTOS_PER_SEARCH }
}

// A year before this one whose window may reach a month of the timeline: its own, or the next or
// the previous one across the turn of the year.
function candidateYears(months: readonly TimelineMonth[], today: PhotoDate): readonly number[] {
  const years = new Set<number>()
  for (const month of months) {
    years
      .add(month.year - 1)
      .add(month.year)
      .add(month.year + 1)
  }
  return [...years].filter((year) => year < today.year).sort((first, second) => first - second)
}

// A day more on each side: Immich may count a photo in the month of its instant in UTC.
function hasPhotosAround(months: readonly TimelineMonth[], search: DateSearch): boolean {
  const first = monthIndex(addDays(search.from, -1))
  const last = monthIndex(addDays(search.to, 1))
  return months.some((month) => {
    const index = monthIndex(month)
    return month.photoCount > 0 && index >= first && index <= last
  })
}

function monthIndex({ year, month }: Pick<PhotoDate, 'year' | 'month'>): number {
  return year * MONTHS_PER_YEAR + month - 1
}

// Each photo once, near today's day in a past year, never in this year.
function placedOf(photos: readonly Photo[], today: PhotoDate): readonly Placed[] {
  const unique = new Map(photos.map((photo) => [photo.id, photo]))
  const placed: Placed[] = []
  for (const photo of unique.values()) {
    const near = placeOf(photo, today)
    if (near !== undefined && photo.date.year < today.year && near.yearsAgo > 0) {
      placed.push(near)
    }
  }
  return placed
}

// Near today's day in its own year, or across the turn of the year in the next or the previous;
// none when it is near today's day in no year.
function placeOf(photo: Photo, today: PhotoDate): Placed | undefined {
  const { year } = photo.date
  return [year, year + 1, year - 1]
    .map((anchor) => placeIn(photo, today, anchor))
    .find((placed) => Math.abs(placed.offset) <= WINDOW_DAYS)
}

function placeIn(photo: Photo, today: PhotoDate, year: number): Placed {
  const offset = dayNumber(photo.date) - dayNumber(sameDayIn(today, year))
  return { photo, yearsAgo: today.year - year, offset }
}

// The offset of the nearest day, the day before at as many days as the day after; none (infinity,
// which no offset equals) without photos.
function nearestOffset(placed: readonly Placed[]): number {
  const distance = Math.min(...placed.map(({ offset }) => Math.abs(offset)))
  return placed.some(({ offset }) => offset === -distance) ? -distance : distance
}

function memoryOf({ photo, yearsAgo }: Placed, today: PhotoDate): Memory {
  const { id: photoId, date } = photo
  return { photoId, yearsAgo, date, isSameDay: isSameDayOfYear(date, today) }
}

function dateKey({ year, month, day }: PhotoDate): string {
  return `${String(year)}-${String(month)}-${String(day)}`
}
