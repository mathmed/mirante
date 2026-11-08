import { describe, expect, it } from 'vitest'

import { provisionalAlbum } from './album-name.ts'
import { pickableAlbums } from './album-picker.ts'
import { NO_EDITS } from './library-edits.ts'
import { type Album, PhotoOrder } from './photo-library.ts'

function album(id: string, name: string): Album {
  return { id, name, photoCount: 1, order: PhotoOrder.NewestFirst }
}

const ALBUMS = [album('a-1', 'Lisboa'), album('a-2', 'Porto'), album('a-3', 'Faro')]

describe('pickableAlbums', () => {
  it('should offer every album but the one the photos are in', () => {
    expect(pickableAlbums(ALBUMS, NO_EDITS, 'a-2').map((sut) => sut.name)).toStrictEqual([
      'Lisboa',
      'Faro',
    ])
    expect(pickableAlbums(ALBUMS, NO_EDITS, undefined)).toHaveLength(3)
  })

  it('should offer the albums as the changes left them, but those still being created', () => {
    const created = album('a-4', 'Sintra')
    const edits = {
      ...NO_EDITS,
      created: [provisionalAlbum('Évora', [], 1), created],
      renamed: new Map([['a-1', 'Lisboa 2024']]),
      deleted: new Set(['a-3']),
    }

    expect(pickableAlbums(ALBUMS, edits, undefined).map((sut) => sut.name)).toStrictEqual([
      'Sintra',
      'Lisboa 2024',
      'Porto',
    ])
  })
})
