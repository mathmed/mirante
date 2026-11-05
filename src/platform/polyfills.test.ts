import { afterEach, describe, expect, it, vi } from 'vitest'

import browserApis from '../../.browser-apis.json'
import esCheck from '../../.escheckrc.json'
import {
  fromEntries,
  installPolyfills,
  POLYFILLED_APIS,
  POLYFILLED_FEATURES,
  queueMicrotask,
} from './polyfills.ts'

// The callback, its rejection and the handler that hands the error to a task.
const MICROTASKS_TO_REPORT = 3

async function settleMicrotasks(): Promise<void> {
  for (let tick = 0; tick < MICROTASKS_TO_REPORT; tick += 1) {
    await Promise.resolve()
  }
}

const NATIVE_FROM_ENTRIES: unknown = Reflect.get(Object, 'fromEntries')
const NATIVE_QUEUE_MICROTASK: unknown = Reflect.get(window, 'queueMicrotask')

afterEach(() => {
  vi.useRealTimers()
  Reflect.defineProperty(Object, 'fromEntries', {
    value: NATIVE_FROM_ENTRIES,
    writable: true,
    configurable: true,
  })
  Reflect.defineProperty(window, 'queueMicrotask', {
    value: NATIVE_QUEUE_MICROTASK,
    enumerable: true,
    writable: true,
    configurable: true,
  })
})

describe('installPolyfills', () => {
  it('should add Object.fromEntries where the engine lacks it', () => {
    Reflect.deleteProperty(Object, 'fromEntries')

    installPolyfills()

    expect(Reflect.get(Object, 'fromEntries')).toBe(fromEntries)
    expect(Object.keys(Object)).not.toContain('fromEntries')
  })

  it('should add queueMicrotask to the window where the engine lacks it', () => {
    Reflect.deleteProperty(window, 'queueMicrotask')

    installPolyfills()

    expect(Reflect.get(window, 'queueMicrotask')).toBe(queueMicrotask)
    expect(Object.getOwnPropertyDescriptor(window, 'queueMicrotask')).toStrictEqual({
      value: queueMicrotask,
      enumerable: true,
      writable: true,
      configurable: true,
    })
  })

  it('should keep what the engine has', () => {
    installPolyfills()

    expect(Reflect.get(Object, 'fromEntries')).toBe(NATIVE_FROM_ENTRIES)
    expect(Reflect.get(window, 'queueMicrotask')).toBe(NATIVE_QUEUE_MICROTASK)
  })

  it('should replace what is not a function', () => {
    Reflect.set(window, 'queueMicrotask', 'not a function')

    installPolyfills()

    expect(Reflect.get(window, 'queueMicrotask')).toBe(queueMicrotask)
  })

  it.each(esCheck)('should be what es-check lets $files use', ({ ignore }) => {
    expect(ignore.split(',').filter((feature) => feature !== '')).toStrictEqual(POLYFILLED_FEATURES)
  })

  it('should be what the API check of the bundle lets the build use', () => {
    expect(browserApis.polyfilled).toStrictEqual(POLYFILLED_APIS)
  })
})

describe('fromEntries', () => {
  it('should build an object like Object.fromEntries does', () => {
    const entries: [string, unknown][] = [
      ['accept', 'application/json'],
      ['x-api-key', 'key'],
      ['accept', 'text/html'],
    ]

    const sut = fromEntries(entries)

    expect(sut).toStrictEqual({ accept: 'text/html', 'x-api-key': 'key' })
    expect(Object.keys(sut)).toStrictEqual(['accept', 'x-api-key'])
  })

  it('should create own properties, never setters of the prototype', () => {
    const sut = fromEntries([['__proto__', 'value']])

    expect(Object.getPrototypeOf(sut)).toBe(Object.prototype)
    expect(Object.getOwnPropertyDescriptor(sut, '__proto__')).toStrictEqual({
      value: 'value',
      enumerable: true,
      writable: true,
      configurable: true,
    })
  })

  it('should read any iterable of entries', () => {
    expect(fromEntries(new Map([['a', 1]]))).toStrictEqual({ a: 1 })
  })
})

describe('queueMicrotask', () => {
  it('should run the callback after the current code, before the next task', async () => {
    const order: string[] = []
    setTimeout(() => {
      order.push('task')
    })

    queueMicrotask(() => {
      order.push('microtask')
    })
    order.push('current')

    await vi.waitFor(() => {
      expect(order).toStrictEqual(['current', 'microtask', 'task'])
    })
  })

  it('should run the callbacks in the order they were queued', async () => {
    const order: number[] = []

    queueMicrotask(() => order.push(1))
    queueMicrotask(() => order.push(2))
    await Promise.resolve()
    await Promise.resolve()

    expect(order).toStrictEqual([1, 2])
  })

  it('should report what the callback throws as an uncaught error, in a task of its own', async () => {
    vi.useFakeTimers()
    const error = new Error('render failed')

    queueMicrotask(() => {
      throw error
    })
    await settleMicrotasks()

    expect(vi.getTimerCount()).toBe(1)
    expect(() => vi.runAllTimers()).toThrow(error)
  })
})
