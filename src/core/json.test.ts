import { describe, expect, it } from 'vitest'

import { fieldsOf, isRecord, parseJson } from './json.ts'

describe('parseJson', () => {
  it('should read JSON', () => {
    expect(parseJson('{"a":[1,true,null]}')).toStrictEqual({ a: [1, true, null] })
  })

  it('should give nothing for text that is not JSON', () => {
    expect(parseJson('{')).toBeUndefined()
  })

  it('should let through what JSON.parse throws besides a syntax error', () => {
    const notText = Symbol('not text') as unknown as string

    expect(() => parseJson(notText)).toThrow(TypeError)
  })
})

describe('isRecord', () => {
  it.each([{}, { a: 1 }])('should take %j for an object', (value) => {
    expect(isRecord(value)).toBe(true)
  })

  it.each([null, [], 'text', 1, undefined])('should not take %j for an object', (value) => {
    expect(isRecord(value)).toBe(false)
  })
})

describe('fieldsOf', () => {
  it('should give the fields of an object by name', () => {
    expect(fieldsOf({ a: 1, b: 'two' })).toStrictEqual(
      new Map<string, unknown>([
        ['a', 1],
        ['b', 'two'],
      ]),
    )
  })

  it.each([null, [1], 'text'])('should give nothing for %j', (value) => {
    expect(fieldsOf(value)).toBeUndefined()
  })
})
