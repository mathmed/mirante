import { describe, expect, it } from 'vitest'

import { randomSeed } from './random-seed.ts'

describe('randomSeed', () => {
  it('should draw an unsigned 32-bit seed, a new one each time', () => {
    const seeds = [...Array(20).keys()].map(() => randomSeed())

    expect(seeds.every((seed) => Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32)).toBe(true)
    expect(new Set(seeds).size).toBeGreaterThan(1)
  })
})
