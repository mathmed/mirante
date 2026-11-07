import { render, waitFor } from '@testing-library/preact'
import type { JSX } from 'preact'
import { describe, expect, it } from 'vitest'

import { dateOf, photoOn, photosTaken } from '../../test/dated-photos.ts'
import { stubLibrary } from '../../test/library-stub.ts'
import {
  type Album,
  LibraryFailure,
  type PhotoLibrary,
  PhotoLibraryError,
  PhotoOrder,
} from '../core/photo-library.ts'
import { useBackdrop } from './use-backdrop.ts'

const TODAY = dateOf('2026-11-07')
const NOVEMBER_2023 = { key: '2023-11', year: 2023, month: 11, photoCount: 2 }

function album(id: string, lastPhotoAtMs: number, coverPhotoId?: string): Album {
  const base = { id, name: id, photoCount: 1, order: PhotoOrder.NewestFirst, lastPhotoAtMs }
  return coverPhotoId === undefined ? base : { ...base, coverPhotoId }
}

interface Shown {
  readonly text: () => string | null | undefined
  readonly reported: unknown[]
}

// The log and the clock are the same functions on every render, as the composition root gives them.
function show(library: PhotoLibrary): Shown {
  const reported: unknown[] = []
  const report = (error: unknown): void => {
    reported.push(error)
  }
  const today = (): typeof TODAY => TODAY
  function Harness(): JSX.Element {
    const photos = useBackdrop(library, today, report)
    const lines = photos.map(({ url, caption }) => `${url} ${caption ?? '-'}`)
    return <output>{lines.length === 0 ? 'none' : lines.join(' | ')}</output>
  }
  render(<Harness />)
  return { text: () => document.querySelector('output')?.textContent, reported }
}

// Without photos near today in past years.
const NO_MEMORIES: Partial<PhotoLibrary> = { listTimelineMonths: async () => Promise.resolve([]) }

describe('useBackdrop', () => {
  it('should give no photo while the library is read', () => {
    const sut = show(stubLibrary({ listTimelineMonths: async () => new Promise(() => undefined) }))

    expect(sut.text()).toBe('none')
  })

  it('should give the previews of the photos of today in past years, with how long ago', async () => {
    const photos = [photoOn('2023-11-07', 'a'), photoOn('2023-11-07', 'b')]
    const sut = show(
      stubLibrary({
        listTimelineMonths: async () => Promise.resolve([NOVEMBER_2023]),
        listPhotosTaken: async (search) => Promise.resolve(photosTaken(photos, search)),
      }),
    )

    await waitFor(() => {
      expect(sut.text()).toContain('https://images.test/preview/a Há 3 anos')
    })
    expect(sut.text()).toContain('https://images.test/preview/b Há 3 anos')
    expect(sut.reported).toStrictEqual([])
  })

  it('should give the preview of the cover of the most recent album without them', async () => {
    const sut = show(
      stubLibrary({
        ...NO_MEMORIES,
        listAlbums: async () =>
          Promise.resolve([
            album('old', 1, 'old-cover'),
            album('recent-empty', 3),
            album('recent', 2, 'recent-cover'),
          ]),
      }),
    )

    await waitFor(() => {
      expect(sut.text()).toBe('https://images.test/preview/recent-cover -')
    })
  })

  it('should give no photo for a library without covers', async () => {
    const reads: string[] = []
    const sut = show(
      stubLibrary({
        ...NO_MEMORIES,
        listAlbums: async () => {
          reads.push('albums')
          return Promise.resolve([album('empty', 1)])
        },
      }),
    )

    await waitFor(() => {
      expect(reads).toStrictEqual(['albums'])
    })
    await Promise.resolve()
    expect(sut.text()).toBe('none')
    expect(sut.reported).toStrictEqual([])
  })

  it('should give no photo and log why when the albums cannot be read', async () => {
    const error = new PhotoLibraryError(LibraryFailure.ServerError, 'boom')
    const sut = show(stubLibrary({ ...NO_MEMORIES, listAlbums: async () => Promise.reject(error) }))

    await waitFor(() => {
      expect(sut.reported).toStrictEqual([error])
    })
    expect(sut.text()).toBe('none')
  })
})
