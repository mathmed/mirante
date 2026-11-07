import { describe, expect, it } from 'vitest'

import { photos } from '../../test/library-stub.ts'
import {
  albumNameOf,
  isProvisional,
  MAX_ALBUM_NAME_LENGTH,
  provisionalAlbum,
  suggestedName,
  SuggestionKind,
} from './album-name.ts'
import { PhotoOrder } from './photo-library.ts'

const TODAY = { year: 2026, month: 11, day: 7 }

describe('albumNameOf', () => {
  it('should take the name without the blanks around it', () => {
    expect(albumNameOf('  Férias  ')).toBe('Férias')
  })

  it('should refuse a name of blanks alone', () => {
    expect(albumNameOf('')).toBeUndefined()
    expect(albumNameOf(' \n ')).toBeUndefined()
  })

  it('should cut a name too long, without a blank at its end', () => {
    const long = `${'a'.repeat(MAX_ALBUM_NAME_LENGTH - 1)} bc`

    expect(albumNameOf(long)).toBe('a'.repeat(MAX_ALBUM_NAME_LENGTH - 1))
    expect(MAX_ALBUM_NAME_LENGTH).toBe(100)
  })
})

describe('suggestedName', () => {
  it('should name an album of photos of one month after it', () => {
    expect(suggestedName(photos('march', 3), TODAY)).toStrictEqual({
      kind: SuggestionKind.Month,
      year: 2024,
      month: 3,
    })
  })

  it('should name it after today when its photos span months, or years', () => {
    const spread = [
      ...photos('march', 1),
      ...photos('april', 1, { year: 2024, month: 4 }),
      ...photos('old', 1, { year: 2023, month: 3 }),
    ]

    expect(suggestedName(spread, TODAY)).toStrictEqual({ kind: SuggestionKind.Day, date: TODAY })
    expect(suggestedName(spread.slice(1), TODAY).kind).toBe(SuggestionKind.Day)
    expect(
      suggestedName(
        [spread[0], spread[2]].filter((photo) => photo !== undefined),
        TODAY,
      ).kind,
    ).toBe(SuggestionKind.Day)
  })

  it('should name an album without photos after today', () => {
    expect(suggestedName([], TODAY)).toStrictEqual({ kind: SuggestionKind.Day, date: TODAY })
  })
})

describe('provisionalAlbum', () => {
  it('should count its photos, show the first as its cover and sort by the latest', () => {
    const shown = photos('march', 3)

    const sut = provisionalAlbum(
      'Março',
      [shown[1], shown[2], shown[0]].filter((photo) => photo !== undefined),
      4,
    )

    expect(sut).toStrictEqual({
      id: 'new-album-4',
      name: 'Março',
      photoCount: 3,
      order: PhotoOrder.NewestFirst,
      coverPhotoId: 'march-2',
      lastPhotoAtMs: shown[2]?.takenAtMs,
    })
    expect(isProvisional(sut)).toBe(true)
  })

  it('should make an empty album without a cover', () => {
    expect(provisionalAlbum('Vazio', [], 1)).toStrictEqual({
      id: 'new-album-1',
      name: 'Vazio',
      photoCount: 0,
      order: PhotoOrder.NewestFirst,
    })
  })

  it('should tell an album the server created from a provisional one', () => {
    expect(
      isProvisional({
        id: 'album-new-album-1',
        name: '',
        photoCount: 0,
        order: PhotoOrder.NewestFirst,
      }),
    ).toBe(false)
  })
})
