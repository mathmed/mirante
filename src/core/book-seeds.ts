import { fieldsOf, parseJson } from './json.ts'
import type { TextStorage } from './settings-storage.ts'
import { textSeed } from './shuffle.ts'

// The seed of each book this TV reorganized, by the key of its album or month (book-source.ts): the
// same book comes back the same until it is reorganized again. A book never reorganized takes a
// seed from its key, the same on every TV. Kept in its own place of the TV's storage.

export type BookSeeds = ReadonlyMap<string, number>

// Raised whenever the shape of the stored seeds changes in a way an older reader cannot follow.
export const STORED_SEEDS_VERSION = 1
// The books remembered, the most recently reorganized ones: a TV never fills its storage.
export const REMEMBERED_BOOKS = 200

const NO_SEEDS: BookSeeds = new Map()

export function bookSeedOf(seeds: BookSeeds, key: string): number {
  return seeds.get(key) ?? textSeed(key)
}

// The book takes a new seed, and becomes the most recent; the oldest goes past the limit.
export function withBookSeed(seeds: BookSeeds, key: string, seed: number): BookSeeds {
  const kept = [...seeds].filter(([known]) => known !== key)
  return new Map([...kept, [key, seed] as const].slice(-REMEMBERED_BOOKS))
}

// Nothing stored, text that is not JSON, another version or a storage that fails: no seeds, safely.
// A failure goes to the log.
export function restoreBookSeeds(
  storage: TextStorage,
  reportError: (error: unknown) => void,
): BookSeeds {
  try {
    return seedsFromText(storage.read())
  } catch (error) {
    reportError(error)
    return NO_SEEDS
  }
}

// Best effort: a seed that cannot be kept still holds until the app closes.
export function persistBookSeeds(
  storage: TextStorage,
  seeds: BookSeeds,
  reportError: (error: unknown) => void,
): void {
  try {
    storage.write(JSON.stringify({ version: STORED_SEEDS_VERSION, books: [...seeds] }))
  } catch (error) {
    reportError(error)
  }
}

// The pairs of a key and a seed, in their order; anything else is left out.
export function seedsFromText(text: string | undefined): BookSeeds {
  const stored = fieldsOf(text === undefined ? undefined : parseJson(text))
  const books = stored?.get('version') === STORED_SEEDS_VERSION ? stored.get('books') : undefined
  return Array.isArray(books) ? new Map(books.filter(isSeedPair)) : NO_SEEDS
}

function isSeedPair(entry: unknown): entry is readonly [string, number] {
  const pair: readonly unknown[] = Array.isArray(entry) ? entry : []
  const [key, seed, ...rest] = pair
  return typeof key === 'string' && Number.isInteger(seed) && rest.length === 0
}
