import { describe, expect, it, vi } from 'vitest'

import { registerTizenKeys } from './tizen-keys.ts'

describe('registerTizenKeys', () => {
  it('should register the Info key on a Tizen TV, on its input device', () => {
    const calls: unknown[] = []
    const inputDevice = {
      registerKey(this: unknown, key: string): void {
        calls.push(this, key)
      },
    }
    const reported: unknown[] = []

    registerTizenKeys({ tizen: { tvinputdevice: inputDevice } }, (error) => reported.push(error))

    expect(calls).toStrictEqual([inputDevice, 'Info'])
    expect(reported).toStrictEqual([])
  })

  it('should log a key the TV refuses, and go on', () => {
    const error = new Error('NotSupportedError')
    const reported: unknown[] = []

    registerTizenKeys(
      {
        tizen: {
          tvinputdevice: {
            registerKey: () => {
              throw error
            },
          },
        },
      },
      (cause) => reported.push(cause),
    )

    expect(reported).toStrictEqual([error])
  })

  it.each([
    { name: 'a browser', host: {} },
    { name: 'a tizen that is not an object', host: { tizen: 'tizen' } },
    { name: 'a TV without its input device', host: { tizen: {} } },
    { name: 'an input device that is not an object', host: { tizen: { tvinputdevice: 1 } } },
    { name: 'no registerKey', host: { tizen: { tvinputdevice: { registerKey: 'Info' } } } },
  ])('should do nothing in $name', ({ host }) => {
    const reportError = vi.fn<(error: unknown) => void>()

    registerTizenKeys(host, reportError)

    expect(reportError).not.toHaveBeenCalled()
  })
})
