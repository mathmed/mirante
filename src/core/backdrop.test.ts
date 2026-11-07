import { describe, expect, it } from 'vitest'

import { dateOf, photoOn, photosTaken } from '../../test/dated-photos.ts'
import { stubLibrary } from '../../test/library-stub.ts'
import { loadBackdrop } from './backdrop.ts'
import { type Album, type PhotoLibrary, PhotoOrder } from './photo-library.ts'

const TODAY = dateOf('2026-11-07')
const NOVEMBER_2023 = { key: '2023-11', year: 2023, month: 11, photoCount: 1 }
const COVERED: Album = {
  id: 'trip',
  name: 'Viagem',
  photoCount: 1,
  order: PhotoOrder.NewestFirst,
  coverPhotoId: 'trip-cover',
}

const UNCOVERED: Album = {
  id: 'empty',
  name: 'Vazio',
  photoCount: 0,
  order: PhotoOrder.NewestFirst,
}

interface Loaded {
  readonly library: PhotoLibrary
  readonly reported: unknown[]
}

function libraryWith(reads: Partial<PhotoLibrary>): Loaded {
  return { library: stubLibrary(reads), reported: [] }
}

async function load({ library, reported }: Loaded): ReturnType<typeof loadBackdrop> {
  return loadBackdrop(library, TODAY, (error) => reported.push(error))
}

describe('loadBackdrop', () => {
  it('should take turns with the photos of this day in past years', async () => {
    const sut = libraryWith({
      listTimelineMonths: async () => Promise.resolve([NOVEMBER_2023]),
      listPhotosTaken: async (search) =>
        Promise.resolve(photosTaken([photoOn('2023-11-07')], search)),
    })

    expect(await load(sut)).toStrictEqual([
      {
        photoId: '2023-11-07',
        memory: { photoId: '2023-11-07', yearsAgo: 3, date: dateOf('2023-11-07'), isSameDay: true },
      },
    ])
    expect(sut.reported).toStrictEqual([])
  })

  it('should show the cover of the most recent album without photos near this day', async () => {
    const sut = libraryWith({
      listTimelineMonths: async () => Promise.resolve([]),
      listAlbums: async () => Promise.resolve([COVERED]),
    })

    expect(await load(sut)).toStrictEqual([{ photoId: 'trip-cover' }])
    expect(sut.reported).toStrictEqual([])
  })

  it('should log a failed search and show the cover instead', async () => {
    const error = new Error('down')
    const sut = libraryWith({
      listTimelineMonths: async () => Promise.reject(error),
      listAlbums: async () => Promise.resolve([COVERED]),
    })

    expect(await load(sut)).toStrictEqual([{ photoId: 'trip-cover' }])
    expect(sut.reported).toStrictEqual([error])
  })

  it('should show nothing for a library without photos near this day nor covers', async () => {
    const sut = libraryWith({
      listTimelineMonths: async () => Promise.resolve([]),
      listAlbums: async () => Promise.resolve([UNCOVERED]),
    })

    expect(await load(sut)).toStrictEqual([])
  })

  it('should fail when the albums cannot be read either', async () => {
    const error = new Error('albums down')
    const sut = libraryWith({
      listTimelineMonths: async () => Promise.resolve([]),
      listAlbums: async () => Promise.reject(error),
    })

    await expect(load(sut)).rejects.toBe(error)
  })
})
