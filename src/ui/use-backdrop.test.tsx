import { render, waitFor } from '@testing-library/preact'
import type { JSX } from 'preact'
import { describe, expect, it } from 'vitest'

import { stubLibrary } from '../../test/library-stub.ts'
import {
  type Album,
  LibraryFailure,
  type PhotoLibrary,
  PhotoLibraryError,
  PhotoOrder,
} from '../core/photo-library.ts'
import { useBackdrop } from './use-backdrop.ts'

function album(id: string, lastPhotoAtMs: number, coverPhotoId?: string): Album {
  const base = { id, name: id, photoCount: 1, order: PhotoOrder.NewestFirst, lastPhotoAtMs }
  return coverPhotoId === undefined ? base : { ...base, coverPhotoId }
}

interface Shown {
  readonly url: () => string | null | undefined
  readonly reported: unknown[]
}

// The log is the same function on every render, as the composition root gives it.
function show(library: PhotoLibrary): Shown {
  const reported: unknown[] = []
  const report = (error: unknown): void => {
    reported.push(error)
  }
  function Harness(): JSX.Element {
    const url = useBackdrop(library, report)
    return <output>{url ?? 'none'}</output>
  }
  render(<Harness />)
  return { url: () => document.querySelector('output')?.textContent, reported }
}

describe('useBackdrop', () => {
  it('should give no photo while the albums load', () => {
    const sut = show(stubLibrary({ listAlbums: async () => new Promise(() => undefined) }))

    expect(sut.url()).toBe('none')
  })

  it('should give the preview of the cover of the most recent album that has one', async () => {
    const sut = show(
      stubLibrary({
        listAlbums: async () =>
          Promise.resolve([
            album('old', 1, 'old-cover'),
            album('recent-empty', 3),
            album('recent', 2, 'recent-cover'),
          ]),
      }),
    )

    await waitFor(() => {
      expect(sut.url()).toBe('https://images.test/preview/recent-cover')
    })
  })

  it('should give no photo for a library without covers', async () => {
    const reads: string[] = []
    const sut = show(
      stubLibrary({
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
    expect(sut.url()).toBe('none')
    expect(sut.reported).toStrictEqual([])
  })

  it('should give no photo and log why when the albums cannot be read', async () => {
    const error = new PhotoLibraryError(LibraryFailure.ServerError, 'boom')
    const sut = show(stubLibrary({ listAlbums: async () => Promise.reject(error) }))

    await waitFor(() => {
      expect(sut.reported).toStrictEqual([error])
    })
    expect(sut.url()).toBe('none')
  })
})
