import type { PhotoLibrary, TimelineMonth } from './photo-library.ts'

// What the start screen says of the library, from the months of its timeline: how many photos it
// holds and the years they span.
export interface LibrarySummary {
  readonly photoCount: number
  readonly firstYear: number
  readonly lastYear: number
}

export async function loadLibrarySummary(
  library: PhotoLibrary,
): Promise<LibrarySummary | undefined> {
  return summarizeLibrary(await library.listTimelineMonths())
}

// None for a library without photos. A month the server lists without any counts for nothing,
// neither in the total nor in the years.
export function summarizeLibrary(months: readonly TimelineMonth[]): LibrarySummary | undefined {
  const counted = months.filter((month) => month.photoCount > 0)
  if (counted.length === 0) {
    return undefined
  }
  const years = counted.map((month) => month.year)
  return {
    photoCount: counted.reduce((total, month) => total + month.photoCount, 0),
    firstYear: Math.min(...years),
    lastYear: Math.max(...years),
  }
}
