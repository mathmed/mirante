import { describe, expect, it } from 'vitest'

import { randomSequence, roundSeed, shuffled, textSeed } from './shuffle.ts'

const ITEMS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

describe('randomSequence', () => {
  it('should draw the same numbers from the same seed', () => {
    const sut = randomSequence(42)

    expect([sut(), sut(), sut()]).toStrictEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
    ])
  })

  it('should draw from 0 up to 1, never 1', () => {
    const sut = randomSequence(7)
    const numbers = [...Array(1000).keys()].map(() => sut())

    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...numbers)).toBeLessThan(1)
  })

  it('should draw unrelated numbers from nearby seeds', () => {
    expect(randomSequence(1)()).toBeCloseTo(0.627_073_940_588, 12)
    expect(randomSequence(2)()).toBeCloseTo(0.734_250_944_341, 12)
  })

  it('should read the seed as an unsigned 32-bit number', () => {
    expect(randomSequence(-1)()).toBe(randomSequence(0xff_ff_ff_ff)())
  })
})

describe('shuffled', () => {
  it('should keep every item once', () => {
    const sut = shuffled(ITEMS, 1)

    expect([...sut].sort((first, second) => first.localeCompare(second))).toStrictEqual(ITEMS)
  })

  it('should give the order the seed decides', () => {
    expect(shuffled(ITEMS, 1)).toStrictEqual(['f', 'a', 'e', 'h', 'g', 'b', 'd', 'c'])
    expect(shuffled(ITEMS, 2)).toStrictEqual(['f', 'c', 'b', 'e', 'h', 'd', 'a', 'g'])
  })

  it('should leave the list it was given as it was', () => {
    const items = [...ITEMS]

    shuffled(items, 3)

    expect(items).toStrictEqual(ITEMS)
  })

  it('should shuffle an empty list into an empty list', () => {
    expect(shuffled([], 3)).toStrictEqual([])
  })
})

describe('roundSeed', () => {
  it('should keep the seed for the first round', () => {
    expect(roundSeed(42, 0)).toBe(42)
  })

  it('should move the seed far for each round, as an unsigned 32-bit number', () => {
    expect(roundSeed(42, 1)).toBe(2_654_435_811)
    expect(roundSeed(42, 2)).toBe(1_013_904_284)
  })
})

describe('textSeed', () => {
  it('should give the FNV-1a hash of the text, as an unsigned number', () => {
    expect(textSeed('')).toBe(2_166_136_261)
    expect(textSeed('a')).toBe(0xe4_0c_29_2c)
    expect(textSeed('album:trip')).toBe(textSeed('album:trip'))
    expect(textSeed('album:trip')).not.toBe(textSeed('album:family'))
  })
})
