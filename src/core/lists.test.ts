import { describe, expect, it } from 'vitest'

import { firstOr, zipWith } from './lists.ts'

describe('firstOr', () => {
  it('should give the first item of a list', () => {
    expect(firstOr(['a', 'b'], 'z')).toBe('a')
  })

  it('should give the fallback for an empty list', () => {
    expect(firstOr([], 'z')).toBe('z')
  })
})

describe('zipWith', () => {
  it('should combine the items of two lists side by side', () => {
    expect(
      zipWith([1, 2, 3], ['a', 'b', 'c'], (one, other) => `${String(one)}${other}`),
    ).toStrictEqual(['1a', '2b', '3c'])
  })

  it('should stop at the end of the shorter list', () => {
    const add = (one: number, other: number): number => one + other

    expect(zipWith([1, 2, 3], [10], add)).toStrictEqual([11])
    expect(zipWith([1], [10, 20], add)).toStrictEqual([11])
  })
})
