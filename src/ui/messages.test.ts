import { describe, expect, it } from 'vitest'

import { StartupFailure } from '../core/startup.ts'
import { failureText } from './messages.ts'

const FAILURES = Object.values(StartupFailure)

describe('failureText', () => {
  it.each(FAILURES)('should explain %s with a title and a hint', (failure) => {
    const sut = failureText(failure)

    expect(sut.title).not.toBe('')
    expect(sut.hint).not.toBe('')
  })

  it('should refuse a failure it does not know', () => {
    const unknown = 'gone' as StartupFailure

    expect(() => failureText(unknown)).toThrow('No text for the startup failure "gone"')
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
