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

  it('should stay in a browser, which has neither', () => {
    expect(() => {
      leaveApp({})
    }).not.toThrow()
  })
})
