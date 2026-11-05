import type { PhotoDate } from './photo-library.ts'

const MS_PER_HOUR = 3_600_000

// Immich keeps the instant a photo was taken and the offset of the place where it was taken. The
// date it shows is the instant moved by that offset, read in UTC: never the time zone of the TV.
export function photoDateOf(instantMs: number, offsetHours: number): PhotoDate {
  const local = new Date(instantMs + offsetHours * MS_PER_HOUR)
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
  }
}
