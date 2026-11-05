import { describe, expect, it } from 'vitest'

import { photoDateOf } from './photo-date.ts'

describe('photoDateOf', () => {
  it('should read the date at the place the photo was taken', () => {
    const sut = photoDateOf(Date.parse('2024-03-12T15:00:00.000Z'), 0)

    expect(sut).toStrictEqual({ year: 2024, month: 3, day: 12 })
  })

  it('should move to the previous day west of Greenwich', () => {
    expect(photoDateOf(Date.parse('2024-01-01T02:00:00.000Z'), -3)).toStrictEqual({
      year: 2023,
      month: 12,
      day: 31,
    })
  })

  it('should move to the next day east of Greenwich, half hours included', () => {
    expect(photoDateOf(Date.parse('2024-02-29T19:00:00.000Z'), 5.5)).toStrictEqual({
      year: 2024,
      month: 3,
      day: 1,
    })
  })
})
