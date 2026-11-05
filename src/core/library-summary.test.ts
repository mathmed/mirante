import { describe, expect, it } from 'vitest'

import { stubLibrary } from '../../test/library-stub.ts'
import { loadLibrarySummary, summarizeLibrary } from './library-summary.ts'
import type { TimelineMonth } from './photo-library.ts'

function month(year: number, number: number, photoCount: number): TimelineMonth {
  return { key: `${String(year)}-${String(number)}`, year, month: number, photoCount }
}

describe('summarizeLibrary', () => {
  it('should count every photo of the timeline and the years from the first to the last', () => {
    const sut = summarizeLibrary([month(2024, 3, 1200), month(2019, 7, 40), month(2026, 11, 1100)])

    expect(sut).toStrictEqual({ photoCount: 2340, firstYear: 2019, lastYear: 2026 })
  })

  it('should give a single year for a library of one year', () => {
    expect(summarizeLibrary([month(2026, 1, 1), month(2026, 2, 2)])).toStrictEqual({
      photoCount: 3,
      firstYear: 2026,
      lastYear: 2026,
    })
  })

  it('should leave the months without a photo out of the years', () => {
    expect(
      summarizeLibrary([month(2018, 1, 0), month(2020, 5, 1), month(2030, 1, 0)]),
    ).toStrictEqual({ photoCount: 1, firstYear: 2020, lastYear: 2020 })
  })

  it.each([
    { library: 'an empty timeline', months: [] },
    { library: 'months without photos', months: [month(2024, 1, 0), month(2025, 1, 0)] },
  ])('should give nothing for $library', ({ months }: { months: readonly TimelineMonth[] }) => {
    expect(summarizeLibrary(months)).toBeUndefined()
  })
})

describe('loadLibrarySummary', () => {
  it('should summarize the months the library lists', async () => {
    const library = stubLibrary({
      listTimelineMonths: async () => Promise.resolve([month(2025, 1, 1)]),
    })

    expect(await loadLibrarySummary(library)).toStrictEqual({
      photoCount: 1,
      firstYear: 2025,
      lastYear: 2025,
    })
  })

  it('should fail when the library fails', async () => {
    const library = stubLibrary({})

    await expect(loadLibrarySummary(library)).rejects.toThrow('unexpected read')
  })
})
