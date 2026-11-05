import { describe, expect, it } from 'vitest'

import { StartupFailure } from '../core/startup.ts'
import {
  counterText,
  failureText,
  monthCountText,
  monthName,
  monthTitle,
  photoCountText,
  photoDateText,
  serverText,
  shortText,
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
    expect(monthTitle({ key: '2024-03-01', year: 2024, month: 3 })).toBe('Março de 2024')
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
