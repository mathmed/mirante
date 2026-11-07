import { describe, expect, it } from 'vitest'

import { addDays, dayNumber, isSameDayOfYear, sameDayIn } from './calendar.ts'

describe('dayNumber', () => {
  it('should count the days from January 1st, 1970', () => {
    expect(dayNumber({ year: 1970, month: 1, day: 1 })).toBe(0)
    expect(dayNumber({ year: 1970, month: 2, day: 1 })).toBe(31)
    expect(dayNumber({ year: 2024, month: 3, day: 1 })).toBe(19_783)
  })
})

describe('addDays', () => {
  it('should move forward across the turn of the year', () => {
    expect(addDays({ year: 2025, month: 12, day: 20 }, 30)).toStrictEqual({
      year: 2026,
      month: 1,
      day: 19,
    })
  })

  it('should move backward across February 29th', () => {
    expect(addDays({ year: 2024, month: 3, day: 1 }, -1)).toStrictEqual({
      year: 2024,
      month: 2,
      day: 29,
    })
  })
})

describe('isSameDayOfYear', () => {
  it('should compare the month and the day, whatever the year', () => {
    const sut = { year: 2026, month: 11, day: 7 }

    expect(isSameDayOfYear(sut, { year: 2020, month: 11, day: 7 })).toBe(true)
    expect(isSameDayOfYear(sut, { year: 2026, month: 11, day: 8 })).toBe(false)
    expect(isSameDayOfYear(sut, { year: 2026, month: 10, day: 7 })).toBe(false)
  })
})

describe('sameDayIn', () => {
  it('should keep the month and the day in another year', () => {
    expect(sameDayIn({ year: 2026, month: 11, day: 7 }, 2023)).toStrictEqual({
      year: 2023,
      month: 11,
      day: 7,
    })
  })

  it('should keep February 29th in a leap year', () => {
    expect(sameDayIn({ year: 2028, month: 2, day: 29 }, 2024)).toStrictEqual({
      year: 2024,
      month: 2,
      day: 29,
    })
  })

  it('should take February 29th to the 28th in a year without one', () => {
    expect(sameDayIn({ year: 2028, month: 2, day: 29 }, 2027)).toStrictEqual({
      year: 2027,
      month: 2,
      day: 28,
    })
    expect(sameDayIn({ year: 2028, month: 2, day: 29 }, 1900)).toStrictEqual({
      year: 1900,
      month: 2,
      day: 28,
    })
  })

  it('should keep the other days of February and the 29th of other months', () => {
    expect(sameDayIn({ year: 2028, month: 2, day: 28 }, 2027)).toStrictEqual({
      year: 2027,
      month: 2,
      day: 28,
    })
    expect(sameDayIn({ year: 2028, month: 3, day: 29 }, 2027)).toStrictEqual({
      year: 2027,
      month: 3,
      day: 29,
    })
    expect(sameDayIn({ year: 2028, month: 2, day: 10 }, 2027)).toStrictEqual({
      year: 2027,
      month: 2,
      day: 10,
    })
    expect(sameDayIn({ year: 2028, month: 1, day: 29 }, 2027)).toStrictEqual({
      year: 2027,
      month: 1,
      day: 29,
    })
  })
})
