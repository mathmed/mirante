import { describe, expect, it } from 'vitest'

import { BookControl } from '../core/book-navigation.ts'
import { controlText, periodText } from './book-messages.ts'
import { MESSAGES } from './messages.ts'

describe('the texts of a book', () => {
  it.each([
    [{ year: 2024, month: 3, day: 1 }, { year: 2024, month: 3, day: 28 }, 'Março de 2024'],
    [{ year: 2024, month: 3, day: 1 }, { year: 2024, month: 5, day: 2 }, 'Março a maio de 2024'],
    [
      { year: 2023, month: 12, day: 24 },
      { year: 2024, month: 1, day: 2 },
      'Dezembro de 2023 a janeiro de 2024',
    ],
  ])('should say the period of the photos on the cover', (first, last, expected) => {
    expect(periodText(first, last)).toBe(expected)
  })

  it('should say play or pause on the button that plays the book', () => {
    expect(controlText(BookControl.Play, false).text).toBe(MESSAGES.playBook)
    expect(controlText(BookControl.Play, true).text).toBe(MESSAGES.pauseBook)
    expect(controlText(BookControl.Next, false)).toStrictEqual({
      text: '›',
      label: MESSAGES.nextSpread,
    })
  })
})
