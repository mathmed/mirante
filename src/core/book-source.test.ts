import { describe, expect, it } from 'vitest'

import { photos, stubLibrary } from '../../test/library-stub.ts'
import { bookKeyOf, loadBookPhotos } from './book-source.ts'
import { PhotoOrder } from './photo-library.ts'
import { SourceKind } from './presentation-source.ts'

const ALBUM = { id: 'trip', name: 'Viagem', photoCount: 3, order: PhotoOrder.NewestFirst }
const MONTH = { key: '2024-03-01', year: 2024, month: 3, photoCount: 3 }

describe('loadBookPhotos', () => {
  it('should read the photos of an album in the order the album shows them', async () => {
    const library = stubLibrary({ listAlbumPhotos: async () => Promise.resolve(photos('p', 3)) })

    const sut = await loadBookPhotos(library, { kind: SourceKind.Album, album: ALBUM })

    expect(sut.map(({ id }) => id)).toStrictEqual(['p-3', 'p-2', 'p-1'])
  })

  it('should read the photos of a month from its first to its last', async () => {
    const library = stubLibrary({
      listMonthPhotos: async () => Promise.resolve([...photos('m', 3)].reverse()),
    })

    const sut = await loadBookPhotos(library, { kind: SourceKind.Month, month: MONTH })

    expect(sut.map(({ id }) => id)).toStrictEqual(['m-1', 'm-2', 'm-3'])
  })
})

describe('bookKeyOf', () => {
  it('should key the book of an album by its id, and the book of a month by its name', () => {
    expect(bookKeyOf({ kind: SourceKind.Album, album: ALBUM })).toBe('album:trip')
    expect(bookKeyOf({ kind: SourceKind.Month, month: MONTH })).toBe('month:2024-03-01')
  })
})
