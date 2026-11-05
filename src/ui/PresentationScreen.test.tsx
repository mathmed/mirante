import { act, render, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { photos, stubLibrary } from '../../test/library-stub.ts'
import { presentationControls } from '../../test/presentation-controls.ts'
import { fakeRemote, type FakeRemote } from '../../test/remote.ts'
import { START_POSITION } from '../core/grid.ts'
import {
  LibraryFailure,
  type PhotoLibrary,
  PhotoLibraryError,
  PhotoOrder,
} from '../core/photo-library.ts'
import type { PresentationSettings } from '../core/presentation-settings.ts'
import { LIBRARY_SOURCE, type PresentationSource, SourceKind } from '../core/presentation-source.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { failureText, MESSAGES } from './messages.ts'
import { PresentationScreen } from './PresentationScreen.tsx'

const INTERVAL_MS = 3000
const MICROTASKS = 10
const ALBUM = { id: 'trip', name: 'Viagem', photoCount: 4, order: PhotoOrder.OldestFirst }
const ALBUM_SOURCE: PresentationSource = { kind: SourceKind.Album, album: ALBUM }

interface Shown {
  readonly remote: FakeRemote
  readonly reported: unknown[]
  readonly back: () => void
}

function show(
  library: PhotoLibrary,
  source: PresentationSource,
  settings: Partial<PresentationSettings> = {},
): Shown {
  const remote = fakeRemote()
  const reported: unknown[] = []
  const back = vi.fn<() => void>()
  const { controls } = presentationControls({ intervalSeconds: 3, ...settings })
  render(
    <PresentationScreen
      library={library}
      source={source}
      keys={remote.keys}
      reportError={(error) => reported.push(error)}
      position={START_POSITION}
      open={() => undefined}
      back={back}
      presentation={controls}
    />,
  )
  return { remote, reported, back }
}

async function settled(): Promise<void> {
  await act(async () => {
    for (let tick = 0; tick < MICROTASKS; tick += 1) {
      await Promise.resolve()
    }
  })
}

async function next(): Promise<void> {
  void act(() => {
    vi.advanceTimersByTime(INTERVAL_MS)
  })
  await settled()
}

function shown(): string | undefined {
  return document.querySelector('.slide.is-current img')?.getAttribute('src')?.split('/').pop()
}

function counter(): string | null | undefined {
  return document.querySelector('.viewer-counter')?.textContent
}

// Draws of the library: one list of photos for each draw, in turn.
function drawing(...draws: readonly (readonly string[] | Error)[]): {
  readonly library: PhotoLibrary
  readonly counts: number[]
} {
  const counts: number[] = []
  let draw = 0
  return {
    counts,
    library: stubLibrary({
      readCaption: async () => Promise.resolve(undefined),
      listRandomPhotos: async (count) => {
        counts.push(count)
        const answer = draws[Math.min(draw, draws.length - 1)]
        draw += 1
        return answer instanceof Error
          ? Promise.reject(answer)
          : Promise.resolve(photos('x', 9).filter((photo) => answer?.includes(photo.id) === true))
      },
    }),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PresentationScreen', () => {
  it('should say what it presents while the photos load', () => {
    show(stubLibrary({ listAlbumPhotos: async () => new Promise(() => undefined) }), ALBUM_SOURCE)

    expect(screen.getByRole('heading', { level: 1, name: ALBUM.name })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe(MESSAGES.loading)
  })

  it('should explain a library that fails', async () => {
    const error = new PhotoLibraryError(LibraryFailure.Unreachable, 'timeout')
    const sut = show(
      stubLibrary({ listRandomPhotos: async () => Promise.reject(error) }),
      LIBRARY_SOURCE,
    )
    await settled()

    expect(screen.getByRole('alert').textContent).toContain(
      failureText(LibraryFailure.Unreachable).title,
    )
    expect(screen.getByRole('heading', { level: 1, name: MESSAGES.wholeLibrary })).toBeTruthy()
    expect(sut.reported).toStrictEqual([error])
  })

  it('should play the photos in the random order of its seed, each once', async () => {
    const album = stubLibrary({
      readCaption: async () => Promise.resolve(undefined),
      listAlbumPhotos: async () => Promise.resolve(photos('p', 4)),
    })
    show(album, ALBUM_SOURCE, { order: 'random' })
    await settled()

    const order = [shown()]
    await next()
    order.push(shown())
    await next()
    order.push(shown())
    await next()
    order.push(shown())

    expect(order).toStrictEqual(['p-3', 'p-1', 'p-4', 'p-2'])
  })

  it('should draw a new round of the library while the last one plays', async () => {
    const sut = drawing(['x-1', 'x-2'], ['x-3', 'x-4'], ['x-5', 'x-6'])
    show(sut.library, LIBRARY_SOURCE, { order: 'oldest-first' })
    await settled()
    expect(counter()).toBe('1 de 2')
    expect(sut.counts).toStrictEqual([200, 200])

    await next()
    await next()

    expect(['x-3', 'x-4']).toContain(shown())
    expect(counter()).toBe('1 de 2')
    expect(sut.counts).toStrictEqual([200, 200, 200])
  })

  it('should play the last round again when a draw fails, and log it', async () => {
    const error = new Error('unreachable')
    const sut = drawing(['x-1', 'x-2'], error)
    const screenShown = show(sut.library, LIBRARY_SOURCE)
    await settled()

    await next()
    await next()

    expect(['x-1', 'x-2']).toContain(shown())
    expect(screenShown.reported).toStrictEqual([error, error])
  })

  it('should go back on Back', async () => {
    const sut = show(drawing(['x-1']).library, LIBRARY_SOURCE)
    await settled()

    sut.remote.press(RemoteKey.Back)

    expect(sut.back).toHaveBeenCalledOnce()
  })
})
