import { describe, expect, it } from 'vitest'

import { localDate } from './local-date.ts'

describe('localDate', () => {
  it('should read the day in the time zone of the TV, late in the evening too', () => {
    const sut = localDate(new Date(2026, 10, 7, 23, 30))

    expect(sut).toStrictEqual({ year: 2026, month: 11, day: 7 })
  })
})
