import type { PhotoDate } from './photo-library.ts'

// Days on the calendar alone, counted in UTC: no time zone and no daylight saving move them.
const MS_PER_DAY = 86_400_000
const FEBRUARY = 2
const LEAP_DAY = 29
const LAST_DAY_OF_FEBRUARY = 28

// The days from January 1st, 1970, to this date.
export function dayNumber({ year, month, day }: PhotoDate): number {
  return Date.UTC(year, month - 1, day) / MS_PER_DAY
}

export function addDays(date: PhotoDate, days: number): PhotoDate {
  const moved = new Date((dayNumber(date) + days) * MS_PER_DAY)
  return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1, day: moved.getUTCDate() }
}

export function isSameDayOfYear(first: PhotoDate, second: PhotoDate): boolean {
  return first.month === second.month && first.day === second.day
}

// The same month and day in another year; February 29th falls on the 28th of a year without one.
export function sameDayIn(date: PhotoDate, year: number): PhotoDate {
  const moved = { year, month: date.month, day: date.day }
  if (date.month !== FEBRUARY || date.day !== LEAP_DAY || isLeapYear(year)) {
    return moved
  }
  return { ...moved, day: LAST_DAY_OF_FEBRUARY }
}

function isLeapYear(year: number): boolean {
  return addDays({ year, month: FEBRUARY, day: LAST_DAY_OF_FEBRUARY }, 1).month === FEBRUARY
}
