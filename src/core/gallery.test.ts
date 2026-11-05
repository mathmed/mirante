import { describe, expect, it } from 'vitest'

import { stubLibrary } from '../../test/library-stub.ts'
import {
  backdropPhotoId,
  loadAlbumPhotos,
  loadAlbums,
  loadMonthPhotos,
  loadTimeline,
  sortAlbums,
  sortPhotos,
  timelineYears,
} from './gallery.ts'
import { type Album, type Photo, PhotoOrder, type TimelineMonth } from './photo-library.ts'

function album(id: string, lastPhotoAtMs?: number): Album {
  const base = { id, name: `Album ${id}`, photoCount: 1, order: PhotoOrder.NewestFirst }
  return lastPhotoAtMs === undefined ? base : { ...base, lastPhotoAtMs }
}

function photo(id: string, takenAtMs: number): Photo {
  return { id, takenAtMs, date: { year: 2024, month: 1, day: 1 } }
}

function month(
  year: number,
  number: number,
  key = `${String(year)}-${String(number)}`,
): TimelineMonth {
  return { key, year, month: number, photoCount: 1 }
}

const ids = (items: readonly { readonly id: string }[]): string[] => items.map((item) => item.id)

describe('backdropPhotoId', () => {
  it('should take the cover of the first album that has one', () => {
    const sut = backdropPhotoId([
      album('empty'),
      { ...album('trip', 30), coverPhotoId: 'trip-cover' },
      { ...album('family', 20), coverPhotoId: 'family-cover' },
    ])

    expect(sut).toBe('trip-cover')
  })

  it('should give no photo when no album has a cover', () => {
    expect(backdropPhotoId([album('a', 1), album('b', 2)])).toBeUndefined()
    expect(backdropPhotoId([])).toBeUndefined()
  })
})

describe('sortAlbums', () => {
  it('should put the albums with the most recent photos first and the empty ones last', () => {
    const sut = sortAlbums([album('a', 10), album('empty'), album('b', 30), album('c', 20)])

    expect(ids(sut)).toStrictEqual(['b', 'c', 'a', 'empty'])
  })

  it('should order albums of the same moment, or all empty, by id', () => {
    expect(ids(sortAlbums([album('b', 5), album('a', 5)]))).toStrictEqual(['a', 'b'])
    expect(ids(sortAlbums([album('z'), album('y'), album('x')]))).toStrictEqual(['x', 'y', 'z'])
  })

  it('should leave the list it was given untouched', () => {
    const albums = [album('a', 1), album('b', 2)]

    sortAlbums(albums)

    expect(ids(albums)).toStrictEqual(['a', 'b'])
  })
})

describe('sortPhotos', () => {
  const photos = [photo('mid', 20), photo('old', 10), photo('new', 30)]

  it('should put the oldest photos first', () => {
    expect(ids(sortPhotos(photos, PhotoOrder.OldestFirst))).toStrictEqual(['old', 'mid', 'new'])
  })

  it('should put the newest photos first', () => {
    expect(ids(sortPhotos(photos, PhotoOrder.NewestFirst))).toStrictEqual(['new', 'mid', 'old'])
  })

  it.each(Object.values(PhotoOrder))(
    'should order photos of the same instant by id (%s)',
    (order) => {
      expect(ids(sortPhotos([photo('b', 1), photo('c', 1), photo('a', 1)], order))).toStrictEqual([
        'a',
        'b',
        'c',
      ])
    },
  )

  it('should leave the list it was given untouched', () => {
    sortPhotos(photos, PhotoOrder.OldestFirst)

    expect(ids(photos)).toStrictEqual(['mid', 'old', 'new'])
  })
})

describe('timelineYears', () => {
  it('should group the months by year, the most recent year first', () => {
    const sut = timelineYears([month(2023, 12), month(2024, 3), month(2023, 1), month(2024, 1)])

    expect(sut).toStrictEqual([
      { year: 2024, months: [month(2024, 1), month(2024, 3)] },
      { year: 2023, months: [month(2023, 1), month(2023, 12)] },
    ])
  })

  it('should order two buckets of the same month by key', () => {
    const sut = timelineYears([month(2024, 5, 'b'), month(2024, 5, 'a')])

    expect(sut[0]?.months.map((item) => item.key)).toStrictEqual(['a', 'b'])
  })

  it('should give no year to an empty library', () => {
    expect(timelineYears([])).toStrictEqual([])
  })
})

describe('the loads of the screens', () => {
  it('should sort the albums of the library', async () => {
    const library = stubLibrary({
      listAlbums: async () => Promise.resolve([album('a', 1), album('b', 2)]),
    })

    expect(ids(await loadAlbums(library))).toStrictEqual(['b', 'a'])
  })

  it('should sort the photos of an album in the order of the album', async () => {
    const oldestFirst = { ...album('trip', 2), order: PhotoOrder.OldestFirst }
    const asked: Album[] = []
    const library = stubLibrary({
      listAlbumPhotos: async (received) => {
        asked.push(received)
        return Promise.resolve([photo('second', 2), photo('first', 1)])
      },
    })

    expect(ids(await loadAlbumPhotos(library, oldestFirst))).toStrictEqual(['first', 'second'])
    expect(asked).toStrictEqual([oldestFirst])
  })

  it('should group the months of the timeline by year', async () => {
    const library = stubLibrary({
      listTimelineMonths: async () => Promise.resolve([month(2023, 2), month(2024, 7)]),
    })

    expect((await loadTimeline(library)).map((year) => year.year)).toStrictEqual([2024, 2023])
  })

  it('should list the photos of a month from the first to the last', async () => {
    const asked: TimelineMonth[] = []
    const library = stubLibrary({
      listMonthPhotos: async (received) => {
        asked.push(received)
        return Promise.resolve([photo('late', 9), photo('early', 3)])
      },
    })

    expect(ids(await loadMonthPhotos(library, month(2024, 2)))).toStrictEqual(['early', 'late'])
    expect(asked).toStrictEqual([month(2024, 2)])
  })
})
