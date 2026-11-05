import { describe, expect, it } from 'vitest'

import { localTextStorage, SETTINGS_KEY } from './local-settings.ts'

describe('localTextStorage', () => {
  it('should keep the text under its key in the localStorage of the page', () => {
    window.localStorage.clear()
    const sut = localTextStorage(window, SETTINGS_KEY)

    expect(sut.read()).toBeUndefined()
    sut.write('{"version":1}')

    expect(window.localStorage.getItem('mirante.presentation')).toBe('{"version":1}')
    expect(sut.read()).toBe('{"version":1}')
    window.localStorage.clear()
  })

  it('should let what the storage throws through, for the core to log', () => {
    const error = new DOMException('denied', 'SecurityError')
    const sut = localTextStorage(
      {
        get localStorage(): Storage {
          throw error
        },
      },
      SETTINGS_KEY,
    )

    expect(() => sut.read()).toThrow(error)
    expect(() => {
      sut.write('{}')
    }).toThrow(error)
  })
})
