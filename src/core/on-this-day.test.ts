import { describe, expect, it } from 'vitest'

import { dateOf, photoOn, photosTaken } from '../../test/dated-photos.ts'
import { stubLibrary } from '../../test/library-stub.ts'
import { loadMemories, MEMORY_LIMIT, pickMemories, searchesOf, Side } from './on-this-day.ts'
import {
  type DateSearch,
  type Photo,
  type PhotoLibrary,
  PhotoOrder,
  type TimelineMonth,
} from './photo-library.ts'

const TODAY = dateOf('2026-11-07')

function month(year: number, number: number, photoCount = 1): TimelineMonth {
  return { key: `${String(year)}-${String(number)}`, year, month: number, photoCount }
}

function ids(photos: readonly { readonly photoId: string }[]): readonly string[] {
  return photos.map((photo) => photo.photoId)
}

interface Searched {
  readonly library: PhotoLibrary
  readonly searches: DateSearch[]
}

// A library with these photos, its months counted from them, that records every search.
function searchedLibrary(photos: readonly Photo[]): Searched {
  const searches: DateSearch[] = []
  const counts = new Map<string, TimelineMonth>()
  for (const { date } of photos) {
    const key = `${String(date.year)}-${String(date.month)}`
    const counted = counts.get(key)?.photoCount ?? 0
    counts.set(key, month(date.year, date.month, counted + 1))
  }
  const library = stubLibrary({
    listTimelineMonths: async () => Promise.resolve([...counts.values()]),
    listPhotosTaken: async (search) => {
      searches.push(search)
      return Promise.resolve(photosTaken(photos, search))
    },
  })
  return { library, searches }
}

describe('pickMemories', () => {
  it('should take the photos of today in past years, with how long ago', () => {
    const sut = pickMemories(
      [photoOn('2023-11-07'), photoOn('2020-11-07'), photoOn('2023-11-06')],
      TODAY,
    )

    expect([...sut].sort((first, second) => first.yearsAgo - second.yearsAgo)).toStrictEqual([
      { photoId: '2023-11-07', yearsAgo: 3, date: dateOf('2023-11-07'), isSameDay: true },
      { photoId: '2020-11-07', yearsAgo: 6, date: dateOf('2020-11-07'), isSameDay: true },
    ])
  })

  it('should leave out the photos of this year', () => {
    const sut = pickMemories([photoOn('2026-11-07'), photoOn('2026-11-06')], TODAY)

    expect(sut).toStrictEqual([])
  })

  it('should take last year as one year ago', () => {
    const sut = pickMemories([photoOn('2026-11-07'), photoOn('2025-11-07')], TODAY)

    expect(sut).toStrictEqual([
      { photoId: '2025-11-07', yearsAgo: 1, date: dateOf('2025-11-07'), isSameDay: true },
    ])
  })

  it('should take the nearest day when none falls on today, with its date', () => {
    const sut = pickMemories(
      [photoOn('2022-11-12'), photoOn('2022-11-04'), photoOn('2019-11-04')],
      TODAY,
    )

    expect([...ids(sut)].sort((first, second) => first.localeCompare(second))).toStrictEqual([
      '2019-11-04',
      '2022-11-04',
    ])
    expect(sut.map((memory) => memory.isSameDay)).toStrictEqual([false, false])
    expect(sut.find((memory) => memory.photoId === '2022-11-04')?.yearsAgo).toBe(4)
  })

  it('should prefer the day before to the day after at the same distance', () => {
    expect(ids(pickMemories([photoOn('2022-11-09'), photoOn('2022-11-05')], TODAY))).toStrictEqual([
      '2022-11-05',
    ])
    expect(ids(pickMemories([photoOn('2022-11-05'), photoOn('2022-11-09')], TODAY))).toStrictEqual([
      '2022-11-05',
    ])
  })

  it('should prefer one day after to two days before', () => {
    const sut = pickMemories([photoOn('2022-11-05'), photoOn('2022-11-08')], TODAY)

    expect(ids(sut)).toStrictEqual(['2022-11-08'])
  })

  it('should reach thirty days on either side, and no further', () => {
    expect(ids(pickMemories([photoOn('2022-12-07'), photoOn('2022-12-08')], TODAY))).toStrictEqual([
      '2022-12-07',
    ])
    expect(ids(pickMemories([photoOn('2022-10-08'), photoOn('2022-10-07')], TODAY))).toStrictEqual([
      '2022-10-08',
    ])
    expect(pickMemories([photoOn('2022-12-08'), photoOn('2022-10-07')], TODAY)).toStrictEqual([])
  })

  it('should count the years from the day it is near, across the turn of the year', () => {
    const sut = pickMemories([photoOn('2024-12-28')], dateOf('2026-01-03'))

    expect(sut).toStrictEqual([
      { photoId: '2024-12-28', yearsAgo: 1, date: dateOf('2024-12-28'), isSameDay: false },
    ])
  })

  it('should take a day after across the turn of the year', () => {
    const sut = pickMemories([photoOn('2025-01-05')], dateOf('2026-12-29'))

    expect(sut).toStrictEqual([
      { photoId: '2025-01-05', yearsAgo: 2, date: dateOf('2025-01-05'), isSameDay: false },
    ])
  })

  it('should leave out the end of last year when it is near today in this year', () => {
    const sut = pickMemories([photoOn('2025-12-28')], dateOf('2026-01-03'))

    expect(sut).toStrictEqual([])
  })

  it('should leave out a photo of this January near today in last December', () => {
    const sut = pickMemories([photoOn('2026-01-05'), photoOn('2025-01-05')], dateOf('2026-12-20'))

    expect(ids(sut)).toStrictEqual(['2025-01-05'])
  })

  it('should take February 28th for the 29th in the years without one', () => {
    const sut = pickMemories(
      [photoOn('2024-02-29'), photoOn('2027-02-28'), photoOn('2027-03-01')],
      dateOf('2028-02-29'),
    )

    expect([...sut].sort((first, second) => first.yearsAgo - second.yearsAgo)).toStrictEqual([
      { photoId: '2027-02-28', yearsAgo: 1, date: dateOf('2027-02-28'), isSameDay: false },
      { photoId: '2024-02-29', yearsAgo: 4, date: dateOf('2024-02-29'), isSameDay: true },
    ])
  })

  it('should take February 29th as the day after the 28th', () => {
    const sut = pickMemories([photoOn('2024-02-29')], dateOf('2027-02-28'))

    expect(sut).toStrictEqual([
      { photoId: '2024-02-29', yearsAgo: 3, date: dateOf('2024-02-29'), isSameDay: false },
    ])
  })

  it('should take each photo once', () => {
    const photo = photoOn('2023-11-07')

    expect(ids(pickMemories([photo, photo], TODAY))).toStrictEqual(['2023-11-07'])
  })

  it('should take none without photos', () => {
    expect(pickMemories([], TODAY)).toStrictEqual([])
  })

  it('should take at most the limit, in the same order whatever the order of the answers', () => {
    const photos = [...Array(15).keys()].map((index) =>
      photoOn('2021-11-07', `photo-${String(index).padStart(2, '0')}`),
    )

    const sut = pickMemories(photos, TODAY)

    expect(sut).toHaveLength(MEMORY_LIMIT)
    expect(ids(pickMemories([...photos].reverse(), TODAY))).toStrictEqual(ids(sut))
    expect(ids(sut)).not.toStrictEqual(photos.slice(0, MEMORY_LIMIT).map((photo) => photo.id))
  })

  it('should take turns in another order on another day', () => {
    const photos = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => photoOn('2021-11-07', id))

    const sut = pickMemories(photos, TODAY)

    expect(ids(pickMemories(photos, dateOf('2027-11-07')))).not.toStrictEqual(ids(sut))
  })
})

// "2023-10-8/2023-11-7": the days a search spans.
function spans(searches: readonly DateSearch[]): readonly string[] {
  return searches.map(
    ({ from, to }) =>
      `${String(from.year)}-${String(from.month)}-${String(from.day)}/${String(to.year)}-${String(to.month)}-${String(to.day)}`,
  )
}

describe('searchesOf', () => {
  const MONTHS = [month(2023, 11, 5), month(2020, 10, 3), month(2026, 11, 2), month(2019, 5, 0)]

  it('should search up to today in each past year with photos near it, the newest first', () => {
    const sut = searchesOf(MONTHS, TODAY, Side.Before)

    expect(sut).toStrictEqual([
      {
        from: dateOf('2020-10-08'),
        to: dateOf('2020-11-07'),
        order: PhotoOrder.NewestFirst,
        count: 20,
      },
      {
        from: dateOf('2023-10-08'),
        to: dateOf('2023-11-07'),
        order: PhotoOrder.NewestFirst,
        count: 20,
      },
    ])
  })

  it('should search after today in each past year with photos near it, the oldest first', () => {
    const sut = searchesOf(MONTHS, TODAY, Side.After)

    expect(sut).toStrictEqual([
      {
        from: dateOf('2023-11-08'),
        to: dateOf('2023-12-07'),
        order: PhotoOrder.OldestFirst,
        count: 20,
      },
    ])
  })

  it('should search a month that holds the day before the first one', () => {
    expect(spans(searchesOf([month(2023, 10)], dateOf('2026-12-01'), Side.Before))).toStrictEqual([
      '2023-11-1/2023-12-1',
    ])
    expect(searchesOf([month(2023, 10)], dateOf('2026-12-02'), Side.Before)).toStrictEqual([])
  })

  it('should search a month that holds the day after the last one', () => {
    expect(spans(searchesOf([month(2023, 11)], dateOf('2026-10-01'), Side.After))).toStrictEqual([
      '2023-10-2/2023-10-31',
    ])
    expect(searchesOf([month(2023, 11)], dateOf('2026-09-30'), Side.After)).toStrictEqual([])
  })

  it('should search the year after a December, across the turn of the year', () => {
    const sut = searchesOf([month(2024, 12)], dateOf('2026-01-03'), Side.Before)

    expect(spans(sut)).toStrictEqual(['2024-12-4/2025-1-3'])
  })

  it('should search the year before a January, across the turn of the year', () => {
    const sut = searchesOf([month(2025, 1)], dateOf('2026-12-29'), Side.After)

    expect(spans(sut)).toStrictEqual(['2024-12-30/2025-1-28'])
  })

  it('should never search this year', () => {
    expect(searchesOf([month(2026, 11)], TODAY, Side.Before)).toStrictEqual([])
    expect(searchesOf([month(2025, 12)], dateOf('2026-12-20'), Side.After)).toStrictEqual([
      expect.objectContaining({ from: dateOf('2025-12-21') }),
    ])
  })
})

describe('loadMemories', () => {
  it('should search only up to today when today has photos in a past year', async () => {
    const { library, searches } = searchedLibrary([
      photoOn('2023-11-07'),
      photoOn('2023-11-08'),
      photoOn('2020-11-01'),
    ])

    const sut = await loadMemories(library, TODAY)

    expect(ids(sut)).toStrictEqual(['2023-11-07'])
    expect(searches.map((search) => search.order)).toStrictEqual([
      PhotoOrder.NewestFirst,
      PhotoOrder.NewestFirst,
    ])
  })

  it('should search after today too when no past year has photos on it', async () => {
    const { library, searches } = searchedLibrary([photoOn('2023-11-09'), photoOn('2020-11-04')])

    const sut = await loadMemories(library, TODAY)

    expect(ids(sut)).toStrictEqual(['2023-11-09'])
    expect(searches).toHaveLength(4)
  })

  it('should take the nearest day before over the ones after', async () => {
    const { library } = searchedLibrary([photoOn('2023-11-09'), photoOn('2020-11-06')])

    expect(ids(await loadMemories(library, TODAY))).toStrictEqual(['2020-11-06'])
  })

  it('should give none, without searching, for a library without past years', async () => {
    const { library, searches } = searchedLibrary([photoOn('2026-11-07')])

    expect(await loadMemories(library, TODAY)).toStrictEqual([])
    expect(searches).toStrictEqual([])
  })

  it('should fail when a search fails', async () => {
    const error = new Error('down')
    const library = stubLibrary({
      listTimelineMonths: async () => Promise.resolve([month(2023, 11)]),
      listPhotosTaken: async () => Promise.reject(error),
    })

    await expect(loadMemories(library, TODAY)).rejects.toBe(error)
  })
})
