import { describe, expect, it, vi } from 'vitest'

import { leaveApp } from './app-exit.ts'

describe('leaveApp', () => {
  it('should go back to the launcher through the system of the webOS TV', () => {
    const platformBack = vi.fn<() => void>()

    leaveApp({ PalmSystem: { platformBack } })

    expect(platformBack).toHaveBeenCalledOnce()
  })

  it("should prefer webOSTV.js's call when the page has it", () => {
    const library = vi.fn<() => void>()
    const system = vi.fn<() => void>()

    leaveApp({ webOS: { platformBack: library }, PalmSystem: { platformBack: system } })

    expect(library).toHaveBeenCalledOnce()
    expect(system).not.toHaveBeenCalled()
  })

  it('should keep the system as the object of the call', () => {
    const calls: unknown[] = []
    const system = {
      platformBack(this: unknown): void {
        calls.push(this)
      },
    }

    leaveApp({ PalmSystem: system })

    expect(calls).toStrictEqual([system])
  })

  it('should fall back on the system when webOS has no platformBack', () => {
    const platformBack = vi.fn<() => void>()

    leaveApp({ webOS: {}, PalmSystem: { platformBack } })

    expect(platformBack).toHaveBeenCalledOnce()
  })

  it('should not call what is not a function', () => {
    const platformBack = vi.fn<() => void>()

    leaveApp({ webOS: { platformBack: 'back' }, PalmSystem: { platformBack } })

    expect(platformBack).toHaveBeenCalledOnce()
  })

  it('should not call into a system that is not an object', () => {
    expect(() => {
      leaveApp({ webOS: null, PalmSystem: 'webOS' })
    }).not.toThrow()
  })

  it('should leave the application on a Tizen TV', () => {
    const exit = vi.fn<() => void>()

    leaveApp({ tizen: { application: { getCurrentApplication: () => ({ exit }) } } })

    expect(exit).toHaveBeenCalledOnce()
  })

  it('should keep the Tizen application and the current one as the objects of the calls', () => {
    const calls: unknown[] = []
    const current = {
      exit(this: unknown): void {
        calls.push(this)
      },
    }
    const application = {
      getCurrentApplication(this: unknown): object {
        calls.push(this)
        return current
      },
    }

    leaveApp({ tizen: { application } })

    expect(calls).toStrictEqual([application, current])
  })

  it('should prefer the system of webOS to a tizen global', () => {
    const platformBack = vi.fn<() => void>()
    const getCurrentApplication = vi.fn<() => object>()

    leaveApp({ PalmSystem: { platformBack }, tizen: { application: { getCurrentApplication } } })

    expect(platformBack).toHaveBeenCalledOnce()
    expect(getCurrentApplication).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'a tizen that is not an object', host: { tizen: 'tizen' } },
    { name: 'a tizen without its application', host: { tizen: {} } },
    { name: 'an application that is not an object', host: { tizen: { application: null } } },
    {
      name: 'no current application',
      host: { tizen: { application: { getCurrentApplication: 'app' } } },
    },
    {
      name: 'a current application that is not an object',
      host: { tizen: { application: { getCurrentApplication: () => undefined } } },
    },
    {
      name: 'a current application without exit',
      host: { tizen: { application: { getCurrentApplication: () => ({ exit: 1 }) } } },
    },
  ])('should not call into $name', ({ host }) => {
    expect(() => {
      leaveApp(host)
    }).not.toThrow()
  })

  it('should stay in a browser, which has neither', () => {
    expect(() => {
      leaveApp({})
    }).not.toThrow()
  })
})
