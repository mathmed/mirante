import type { PhotoDate } from '../core/photo-library.ts'

// The day on the TV's own clock, in its own time zone (where the owner lives): the day the start
// screen looks for in past years.
export function localDate(now: Date): PhotoDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}
