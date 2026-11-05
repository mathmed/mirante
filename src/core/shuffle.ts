// A random order that a seed decides: the same seed always gives the same order, so that the tests
// are deterministic and a round can be told from the next one.

// The constants of Mulberry32, a small generator whose nearby seeds still give unrelated numbers.
const INCREMENT = 0x6d_2b_79_f5
const FIRST_SHIFT = 15
const SECOND_SHIFT = 7
const THIRD_SHIFT = 14
const ODD_MIX = 61
const RANGE = 0x1_00_00_00_00
// Far apart seeds for consecutive rounds (the golden ratio of 2^32).
const ROUND_STEP = 0x9e_37_79_b9

// Numbers from 0 (included) to 1 (excluded).
export function randomSequence(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + INCREMENT) >>> 0
    let mixed = Math.imul(state ^ (state >>> FIRST_SHIFT), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> SECOND_SHIFT), mixed | ODD_MIX)
    return ((mixed ^ (mixed >>> THIRD_SHIFT)) >>> 0) / RANGE
  }
}

// Each item once, in an order drawn from the seed.
export function shuffled<T>(items: readonly T[], seed: number): readonly T[] {
  const random = randomSequence(seed)
  const remaining = [...items]
  const result: T[] = []
  while (remaining.length > 0) {
    result.push(...remaining.splice(Math.floor(random() * remaining.length), 1))
  }
  return result
}

// The seed of a later round of the same presentation.
export function roundSeed(seed: number, round: number): number {
  return (seed + Math.imul(round, ROUND_STEP)) >>> 0
}
