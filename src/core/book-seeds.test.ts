import { describe, expect, it } from 'vitest'

import { memoryStorage } from '../../test/memory-storage.ts'
import {
  bookSeedOf,
  persistBookSeeds,
  REMEMBERED_BOOKS,
  restoreBookSeeds,
  seedsFromText,
  STORED_SEEDS_VERSION,
  withBookSeed,
} from './book-seeds.ts'
import { textSeed } from './shuffle.ts'

const FAILING = {
  read: (): string => {
    throw new Error('storage forbidden')
  },
  write: (): void => {
    throw new Error('storage full')
  },
}

describe('bookSeedOf', () => {
  it('should give the seed the TV kept for the book', () => {
    expect(bookSeedOf(new Map([['album:trip', 7]]), 'album:trip')).toBe(7)
  })

  it('should give a book never reorganized the seed of its key, the same on every TV', () => {
    expect(bookSeedOf(new Map(), 'album:trip')).toBe(textSeed('album:trip'))
  })
})

describe('withBookSeed', () => {
  it('should keep the new seed of the book as the most recent', () => {
    const sut = withBookSeed(
      new Map([
        ['a', 1],
        ['b', 2],
      ]),
      'a',
      3,
    )

    expect([...sut]).toStrictEqual([
      ['b', 2],
      ['a', 3],
    ])
  })

  it('should forget the oldest books past the limit', () => {
    const many = new Map(
      [...Array(REMEMBERED_BOOKS).keys()].map((index) => [`b${String(index)}`, index]),
    )
    const sut = withBookSeed(many, 'new', 9)

    expect(sut.size).toBe(REMEMBERED_BOOKS)
    expect(sut.has('b0')).toBe(false)
    expect(sut.get('new')).toBe(9)
  })
})

describe('restoreBookSeeds and persistBookSeeds', () => {
  it('should keep the seeds on the TV and read them back', () => {
    const { storage, written } = memoryStorage()
    const seeds = new Map([
      ['album:trip', 5],
      ['month:2024-03-01', 11],
    ])

    persistBookSeeds(storage, seeds, () => undefined)

    expect(JSON.parse(written[0] ?? '')).toStrictEqual({
      version: STORED_SEEDS_VERSION,
      books: [
        ['album:trip', 5],
        ['month:2024-03-01', 11],
      ],
    })
    expect(restoreBookSeeds(storage, () => undefined)).toStrictEqual(seeds)
  })

  it('should read no seeds from a storage that fails, and report it', () => {
    const reported: unknown[] = []

    expect(restoreBookSeeds(FAILING, (error) => reported.push(error)).size).toBe(0)
    expect(reported).toHaveLength(1)
  })

  it('should report a storage that cannot keep the seeds', () => {
    const reported: unknown[] = []

    persistBookSeeds(FAILING, new Map([['a', 1]]), (error) => reported.push(error))

    expect(reported).toHaveLength(1)
  })
})

describe('seedsFromText', () => {
  it.each([
    { what: 'nothing stored', text: undefined },
    { what: 'text that is not JSON', text: '{' },
    { what: 'another version', text: '{"version":2,"books":[["a",1]]}' },
    { what: 'no list of books', text: '{"version":1,"books":{"a":1}}' },
    { what: 'not an object', text: '[1]' },
  ])('should read no seeds from $what', ({ text }) => {
    expect(seedsFromText(text).size).toBe(0)
  })

  it('should leave out what is not a key and a whole seed', () => {
    const text = JSON.stringify({
      version: 1,
      books: [['a', 1], ['b', 1.5], [2, 3], ['c'], ['d', 4, 5], 'e', ['f', 6]],
    })

    expect([...seedsFromText(text)]).toStrictEqual([
      ['a', 1],
      ['f', 6],
    ])
  })
})
