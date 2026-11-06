import { describe, expect, it } from 'vitest'

import { DEFAULT_PRESENTATION, PlaybackOrder } from './presentation-settings.ts'
import {
  persistSettings,
  restoreSettings,
  settingsFromText,
  STORED_SETTINGS_VERSION,
  storedText,
  type TextStorage,
} from './settings-storage.ts'

const CHOSEN = { ...DEFAULT_PRESENTATION, intervalSeconds: 15, order: PlaybackOrder.Random }
const CONFIG_DEFAULTS = { ...DEFAULT_PRESENTATION, shouldLoop: false }

interface Memory {
  readonly storage: TextStorage
  readonly written: string[]
  readonly reported: unknown[]
}

function memory(text: string | undefined): Memory {
  const written: string[] = []
  return {
    written,
    reported: [],
    storage: {
      read: () => text,
      write: (value) => {
        written.push(value)
      },
    },
  }
}

function failing(error: Error): TextStorage {
  return {
    read: () => {
      throw error
    },
    write: () => {
      throw error
    },
  }
}

describe('storedText', () => {
  it('should write the version of its shape and every setting by its public name', () => {
    expect(JSON.parse(storedText(CHOSEN))).toStrictEqual({
      version: 1,
      settings: {
        intervalSeconds: 15,
        order: 'random',
        transition: 'fade',
        zoom: 'gentle',
        showDate: true,
        showCaption: true,
        showCounter: true,
        loop: true,
        hideInterfaceSeconds: 4,
        reduceEffects: false,
        bookDensity: 'normal',
        bookFormat: 'wide',
        showBookCover: true,
        showPageNumbers: true,
        bookSpreadSeconds: 10,
      },
    })
    expect(STORED_SETTINGS_VERSION).toBe(1)
  })
})

describe('settingsFromText', () => {
  it('should read what it wrote', () => {
    expect(settingsFromText(storedText(CHOSEN), CONFIG_DEFAULTS)).toStrictEqual(CHOSEN)
  })

  it.each([
    { what: 'nothing stored', text: undefined },
    { what: 'text that is not JSON', text: '{"version":1,' },
    { what: 'JSON that is not an object', text: '[1]' },
    {
      what: 'another version',
      text: JSON.stringify({ version: 2, settings: { intervalSeconds: 15 } }),
    },
    { what: 'no version', text: JSON.stringify({ settings: { intervalSeconds: 15 } }) },
  ])('should drop $what for the defaults', ({ text }) => {
    expect(settingsFromText(text, CONFIG_DEFAULTS)).toBe(CONFIG_DEFAULTS)
  })

  it('should keep the defaults for settings that are not an object', () => {
    expect(settingsFromText('{"version":1,"settings":"fast"}', CONFIG_DEFAULTS)).toStrictEqual(
      CONFIG_DEFAULTS,
    )
  })
})

describe('restoreSettings', () => {
  it('should restore the settings of the TV over the defaults', () => {
    const sut = memory(JSON.stringify({ version: 1, settings: { intervalSeconds: 30 } }))

    expect(
      restoreSettings(sut.storage, CONFIG_DEFAULTS, (error) => sut.reported.push(error)),
    ).toStrictEqual({ ...CONFIG_DEFAULTS, intervalSeconds: 30 })
    expect(sut.reported).toStrictEqual([])
  })

  it('should fall back on the defaults and log when the storage fails', () => {
    const error = new Error('SecurityError')
    const reported: unknown[] = []

    expect(restoreSettings(failing(error), CONFIG_DEFAULTS, (cause) => reported.push(cause))).toBe(
      CONFIG_DEFAULTS,
    )
    expect(reported).toStrictEqual([error])
  })
})

describe('persistSettings', () => {
  it('should keep the settings in the storage', () => {
    const sut = memory(undefined)

    persistSettings(sut.storage, CHOSEN, (error) => sut.reported.push(error))

    expect(sut.written).toStrictEqual([storedText(CHOSEN)])
    expect(sut.reported).toStrictEqual([])
  })

  it('should log a storage that cannot keep them, and go on', () => {
    const error = new Error('QuotaExceededError')
    const reported: unknown[] = []

    persistSettings(failing(error), CHOSEN, (cause) => reported.push(cause))

    expect(reported).toStrictEqual([error])
  })
})
