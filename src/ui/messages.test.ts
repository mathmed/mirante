import { describe, expect, it } from 'vitest'

import { StartupFailure } from '../core/startup.ts'
import {
  counterText,
  failureText,
  memoryText,
  monthCountText,
  monthName,
  monthTitle,
  photoCountText,
  photoDateText,
  serverText,
  shortText,
  summaryText,
} from './messages.ts'

const FAILURES = Object.values(StartupFailure)

describe('failureText', () => {
  it.each(FAILURES)('should explain %s with a title and a hint', (failure) => {
    const sut = failureText(failure)

    expect(sut.title).not.toBe('')
    expect(sut.hint).not.toBe('')
  })

  it('should refuse a failure it does not know', () => {
    const unknown = 'gone' as StartupFailure

    expect(() => failureText(unknown)).toThrow('No text for "gone"')
  })

  it('should give every failure its own title', () => {
    const titles = new Set(FAILURES.map((failure) => failureText(failure).title))

    expect(titles.size).toBe(FAILURES.length)
  })

  it('should never show the API key or internal codes', () => {
    const texts = FAILURES.map((failure) => Object.values(failureText(failure)).join(' '))

    for (const failure of FAILURES) {
      expect(texts.join(' ')).not.toContain(failure)
    }
  })
})

describe('summaryText', () => {
  it.each([
    [{ photoCount: 12_340, firstYear: 2019, lastYear: 2026 }, '12.340 fotos · de 2019 a 2026'],
    [{ photoCount: 1, firstYear: 2026, lastYear: 2026 }, '1 foto · de 2026'],
    [{ photoCount: 2, firstYear: 2025, lastYear: 2026 }, '2 fotos · de 2025 a 2026'],
  ])('should say what the library holds: %j', (summary, text) => {
    expect(summaryText(summary)).toBe(text)
  })
})

describe('the texts of the gallery', () => {
  it('should name the server and its Immich version', () => {
    expect(serverText({ address: 'photos.home', version: '3.3.6' })).toBe(
      'Immich 3.3.6 em photos.home',
    )
  })

  it.each([
    [0, '0 fotos'],
    [1, '1 foto'],
    [87, '87 fotos'],
    [999, '999 fotos'],
    [1000, '1.000 fotos'],
    [12_340, '12.340 fotos'],
    [1_002_005, '1.002.005 fotos'],
  ])('should count %i photos as %s', (count, text) => {
    expect(photoCountText(count)).toBe(text)
  })

  it.each([
    [1, '1 mês'],
    [12, '12 meses'],
  ])('should count %i months as %s', (count, text) => {
    expect(monthCountText(count)).toBe(text)
  })

  it.each([
    [1, 'Janeiro'],
    [3, 'Março'],
    [12, 'Dezembro'],
  ])('should name the month %i %s', (month, name) => {
    expect(monthName(month)).toBe(name)
  })

  it.each([0, 13])('should refuse the month %i', (month) => {
    expect(() => monthName(month)).toThrow(`No month ${String(month)}`)
  })

  it('should title a month of the timeline with its year', () => {
    expect(monthTitle({ key: '2024-03-01', year: 2024, month: 3, photoCount: 1 })).toBe(
      'Março de 2024',
    )
  })

  it('should write the date of a photo', () => {
    expect(photoDateText({ year: 2024, month: 3, day: 12 })).toBe('12 de março de 2024')
  })

  it('should count the photo on the screen from 1', () => {
    expect(counterText(11, 87)).toBe('12 de 87')
  })

  it('should keep a text that fits', () => {
    expect(shortText('Viagem', 6)).toBe('Viagem')
  })

  it('should cut a long text to its length, with an ellipsis', () => {
    const sut = shortText('Viagem a Lisboa', 8)

    expect(sut).toBe('Viagem …')
    expect(sut).toHaveLength(8)
  })
})

describe('memoryText', () => {
  const memory = { photoId: 'p', yearsAgo: 3, date: { year: 2023, month: 11, day: 4 } }

  it('should say how many years ago a photo of today was taken', () => {
    expect(memoryText({ ...memory, isSameDay: true })).toBe('Há 3 anos')
  })

  it('should say one year in the singular', () => {
    expect(memoryText({ ...memory, yearsAgo: 1, isSameDay: true })).toBe('Há 1 ano')
  })

  it('should name the day of a photo of the nearest day', () => {
    expect(memoryText({ ...memory, isSameDay: false })).toBe('Há 3 anos, em 4 de novembro')
  })
})
