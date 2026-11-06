import { describe, expect, it } from 'vitest'

import { memoryLibrary, photos, stubLibrary } from '../../test/library-stub.ts'
import { PhotoOrder } from './photo-library.ts'
import { PlaybackOrder } from './presentation-settings.ts'
import {
  drawRound,
  isDrawnEachRound,
  LIBRARY_ROUND_SIZE,
  LIBRARY_SOURCE,
  loadSourcePhotos,
  orderOf,
  type PresentationSource,
  SourceKind,
} from './presentation-source.ts'

const ALBUM = { id: 'trip', name: 'Viagem', photoCount: 3, order: PhotoOrder.NewestFirst }
const MARCH = { key: 'm-2024-03', year: 2024, month: 3, photoCount: 1 }
const APRIL = { key: 'm-2024-04', year: 2024, month: 4, photoCount: 1 }
const MARCH_PHOTOS = photos('march', 150)
const APRIL_PHOTOS = photos('april', 100, { year: 2024, month: 4 })

const LIBRARY = memoryLibrary({
  server: { address: 'immich.test', version: '3.3.6' },
  albums: [ALBUM],
  albumPhotos: new Map([[ALBUM.id, photos('trip', 3)]]),
  months: [MARCH, APRIL],
  monthPhotos: new Map([
    [MARCH.key, MARCH_PHOTOS],
    [APRIL.key, APRIL_PHOTOS],
  ]),
})

const ALBUM_SOURCE: PresentationSource = { kind: SourceKind.Album, album: ALBUM }
const MONTH_SOURCE: PresentationSource = { kind: SourceKind.Month, month: APRIL }
const YEAR_SOURCE: PresentationSource = {
  kind: SourceKind.Year,
  year: { year: 2024, months: [MARCH, APRIL] },
}

function idsOf(list: readonly { readonly id: string }[]): readonly string[] {
  return list.map((photo) => photo.id)
}

describe('loadSourcePhotos', () => {
  it('should read the photos of an album', async () => {
    expect(idsOf(await loadSourcePhotos(LIBRARY, ALBUM_SOURCE))).toStrictEqual([
      'trip-1',
      'trip-2',
      'trip-3',
    ])
  })

  it('should read the photos of a month', async () => {
    expect(await loadSourcePhotos(LIBRARY, MONTH_SOURCE)).toStrictEqual(APRIL_PHOTOS)
  })

  it('should read the photos of every month of a year', async () => {
    expect(await loadSourcePhotos(LIBRARY, YEAR_SOURCE)).toStrictEqual([
      ...MARCH_PHOTOS,
      ...APRIL_PHOTOS,
    ])
  })

  it('should draw a round of photos from the whole library', async () => {
    const sut = await loadSourcePhotos(LIBRARY, LIBRARY_SOURCE)

    expect(LIBRARY_ROUND_SIZE).toBe(200)
    expect(sut).toHaveLength(LIBRARY_ROUND_SIZE)
  })
})

describe('orderOf', () => {
  it.each([ALBUM_SOURCE, MONTH_SOURCE, YEAR_SOURCE])('should keep the order chosen', (source) => {
    expect(orderOf(source, PlaybackOrder.NewestFirst)).toBe(PlaybackOrder.NewestFirst)
  })

  it('should play the library at random', () => {
    expect(orderOf(LIBRARY_SOURCE, PlaybackOrder.OldestFirst)).toBe(PlaybackOrder.Random)
  })
})

describe('isDrawnEachRound', () => {
  it('should draw the library again for each round, and nothing else', () => {
    expect(isDrawnEachRound(LIBRARY_SOURCE)).toBe(true)
    expect([ALBUM_SOURCE, MONTH_SOURCE, YEAR_SOURCE].map(isDrawnEachRound)).toStrictEqual([
      false,
      false,
      false,
    ])
  })
})

describe('drawRound', () => {
  const PREVIOUS = photos('previous', 2)

  it('should draw a new round from the library', async () => {
    const reported: unknown[] = []

    const sut = await drawRound(LIBRARY, PREVIOUS, (error) => reported.push(error))

    expect(sut).toHaveLength(LIBRARY_ROUND_SIZE)
    expect(sut[0]).toBe(MARCH_PHOTOS[0])
    expect(reported).toStrictEqual([])
  })

  it('should play the last round again when the draw comes back empty', async () => {
    const library = stubLibrary({ listRandomPhotos: async () => Promise.resolve([]) })

    expect(await drawRound(library, PREVIOUS, () => undefined)).toBe(PREVIOUS)
  })

  it('should play the last round again and log when the draw fails', async () => {
    const error = new Error('unreachable')
    const reported: unknown[] = []
    const library = stubLibrary({ listRandomPhotos: async () => Promise.reject(error) })

    expect(await drawRound(library, PREVIOUS, (cause) => reported.push(cause))).toBe(PREVIOUS)
    expect(reported).toStrictEqual([error])
  })
})
