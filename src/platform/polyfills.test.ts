import { afterEach, describe, expect, it } from 'vitest'

import esCheck from '../../.escheckrc.json'
import { fromEntries, installPolyfills, POLYFILLED_FEATURES } from './polyfills.ts'

const NATIVE_FROM_ENTRIES: unknown = Reflect.get(Object, 'fromEntries')

afterEach(() => {
  Reflect.defineProperty(Object, 'fromEntries', {
    value: NATIVE_FROM_ENTRIES,
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

  it('should keep the engine’s own Object.fromEntries', () => {
    installPolyfills()

    expect(Reflect.get(Object, 'fromEntries')).toBe(NATIVE_FROM_ENTRIES)
  })

  it('should be what es-check lets the build use', () => {
    expect(esCheck.ignore.split(',').filter((feature) => feature !== '')).toStrictEqual(
      POLYFILLED_FEATURES,
    )
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
