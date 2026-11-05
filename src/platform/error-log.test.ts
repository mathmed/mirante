import { describe, expect, it, vi } from 'vitest'

import { logError } from './error-log.ts'

describe('logError', () => {
  it('should write the error to the console, tagged with the app name', () => {
    const console = vi.spyOn(globalThis.console, 'error').mockImplementation(() => undefined)
    const error = new Error('unreachable')

    logError(error)

    expect(console).toHaveBeenCalledExactlyOnceWith('[mirante]', error)
  })
})
