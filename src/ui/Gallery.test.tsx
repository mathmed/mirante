import { render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it, type Mock, vi } from 'vitest'

import { memoryLibrary, type MemoryLibrary, photos, stubLibrary } from '../../test/library-stub.ts'
import { fakeRemote, type FakeRemote } from '../../test/remote.ts'
import {
  type Album,
  LibraryFailure,
  type PhotoLibrary,
  PhotoLibraryError,
  PhotoOrder,
} from '../core/photo-library.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { Gallery } from './Gallery.tsx'
import { failureText, MESSAGES } from './messages.ts'

const { Up, Down, Left, Right, Enter, Back } = RemoteKey
const SERVER = { address: '192.168.0.10:2283', version: '3.3.6' }

const TRIP = {
  id: 'trip',
  name: 'Viagem a Lisboa',
  photoCount: 30,
  coverPhotoId: 'trip-1',
  order: PhotoOrder.OldestFirst,
  lastPhotoAtMs: Date.UTC(2024, 2, 30),
}
const FAMILY = {
  id: 'family',
  name: 'Família',
  photoCount: 3,
  order: PhotoOrder.NewestFirst,
  lastPhotoAtMs: Date.UTC(2023, 11, 3),
}
const EMPTY = { id: 'empty', name: 'Sem fotos', photoCount: 0, order: PhotoOrder.NewestFirst }

const DATA: MemoryLibrary = {
  server: SERVER,
  albums: [EMPTY, FAMILY, TRIP],
  albumPhotos: new Map([
    [TRIP.id, photos('trip', 30)],
    [FAMILY.id, photos('family', 3, { year: 2023, month: 12 })],
  ]),
  months: [
    { key: 'm-2023-12', year: 2023, month: 12 },
    { key: 'm-2024-04', year: 2024, month: 4 },
    { key: 'm-2024-03', year: 2024, month: 3 },
    { key: 'm-2024-05', year: 2024, month: 5 },
  ],
  monthPhotos: new Map([
    ['m-2024-03', photos('march', 10)],
    ['m-2024-04', photos('april', 2, { year: 2024, month: 4 })],
  ]),
}

interface Shown {
  readonly remote: FakeRemote
  readonly reported: unknown[]
  readonly leave: Mock<() => void>
}

function show(library: PhotoLibrary = memoryLibrary(DATA)): Shown {
  const remote = fakeRemote()
  const reported: unknown[] = []
  const leave = vi.fn<() => void>()
  render(
    <Gallery
      session={{ server: SERVER, library, slideshowSeconds: 8 }}
      keys={remote.keys}
      reportError={(error) => reported.push(error)}
      leave={leave}
    />,
  )
  return { remote, reported, leave }
}

async function title(text: string): Promise<void> {
  await screen.findByRole('heading', { level: 1, name: text })
}

function focused(): string | null | undefined {
  return document.activeElement?.textContent
}

async function focusedOn(text: string): Promise<void> {
  await waitFor(() => {
    expect(focused()).toContain(text)
  })
}

describe('Gallery', () => {
  it('should start on the two ways into the library, with the server below them', async () => {
    show()

    await title(MESSAGES.appName)
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
      MESSAGES.albums,
      MESSAGES.timeline,
    ])
    expect(screen.getByText('Immich 3.3.6 em 192.168.0.10:2283')).toBeTruthy()
    await focusedOn(MESSAGES.albums)
  })

  it('should leave the app on Back from the start screen', async () => {
    const sut = show()
    await focusedOn(MESSAGES.albums)

    sut.remote.press(Back)

    expect(sut.leave).toHaveBeenCalledOnce()
  })

  it('should go back one screen, not leave the app, on Back from a deeper screen', async () => {
    const sut = show()
    sut.remote.press(Enter)
    await title(MESSAGES.albums)

    sut.remote.press(Back)

    await focusedOn(MESSAGES.albums)
    expect(sut.leave).not.toHaveBeenCalled()
  })

  it('should not leave the app on a double Back that reaches the start screen', async () => {
    const sut = show()
    sut.remote.press(Enter)
    await title(MESSAGES.albums)

    sut.remote.pressAtOnce(Back, Back)

    await focusedOn(MESSAGES.albums)
    expect(sut.leave).not.toHaveBeenCalled()
  })

  it('should list the albums with their covers and counts, the most recent first', async () => {
    const sut = show()

    sut.remote.press(Enter)

    await title(MESSAGES.albums)
    await focusedOn(TRIP.name)
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
      `${TRIP.name}30 fotos`,
      `${FAMILY.name}3 fotos`,
      `${EMPTY.name}0 fotos`,
    ])
    expect(screen.getAllByRole('presentation')[0]?.getAttribute('src')).toBe(
      'https://images.test/thumbnail/trip-1',
    )
  })

  it('should say it is loading while the albums come', async () => {
    const sut = show(stubLibrary({ listAlbums: async () => new Promise(() => undefined) }))

    sut.remote.press(Enter)

    await title(MESSAGES.albums)
    expect(screen.getByRole('status').textContent).toBe(MESSAGES.loading)
  })

  it('should open an album, a photo, and come back to where the focus was at each step', async () => {
    const sut = show()
    sut.remote.press(Enter)
    await focusedOn(TRIP.name)

    sut.remote.press(Enter)
    await title(TRIP.name)
    expect((await screen.findAllByRole('img'))[0]?.getAttribute('src')).toBe(
      'https://images.test/thumbnail/trip-1',
    )
    sut.remote.press(Right, Down, Enter)
    expect(screen.getByRole('dialog', { name: '8 de 30' })).toBeTruthy()
    sut.remote.press(Right, Back)

    await waitFor(() => {
      expect(document.activeElement?.querySelector('img')?.getAttribute('alt')).toBe(
        '9 de março de 2024',
      )
    })
    sut.remote.press(Back)
    await focusedOn(TRIP.name)
    sut.remote.press(Back)
    await focusedOn(MESSAGES.albums)
  })

  it('should come back to the album that was opened', async () => {
    const sut = show()
    sut.remote.press(Enter)
    await focusedOn(TRIP.name)

    sut.remote.press(Right, Enter)
    await title(FAMILY.name)
    sut.remote.press(Back)

    await focusedOn(FAMILY.name)
  })

  it('should say an album is empty and go back from it', async () => {
    const sut = show()
    sut.remote.press(Enter)
    await focusedOn(TRIP.name)

    sut.remote.press(Right, Right, Enter)
    await title(EMPTY.name)
    expect(await screen.findByText(MESSAGES.emptyAlbum.title)).toBeTruthy()
    expect(screen.getByText(MESSAGES.emptyAlbum.hint)).toBeTruthy()
    await focusedOn(MESSAGES.back)
    sut.remote.press(Enter)

    await focusedOn(EMPTY.name)
  })

  it('should walk the timeline by year and month, and back', async () => {
    const sut = show()
    await focusedOn(MESSAGES.albums)

    sut.remote.press(Right, Enter)
    await title(MESSAGES.timeline)
    await focusedOn('2024')
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
      '20243 meses',
      '20231 mês',
    ])
    sut.remote.press(Enter)
    await title('2024')
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
      'Março',
      'Abril',
      'Maio',
    ])
    sut.remote.press(Right, Enter)
    await title('Abril de 2024')
    expect(await screen.findAllByRole('img')).toHaveLength(2)

    sut.remote.press(Back)
    await focusedOn('Abril')
    sut.remote.press(Back)
    await focusedOn('2024')
    sut.remote.press(Back)
    await focusedOn(MESSAGES.timeline)
  })

  it('should say a month has no photos', async () => {
    const sut = show()
    await focusedOn(MESSAGES.albums)
    sut.remote.press(Right, Enter)
    await focusedOn('2024')

    sut.remote.press(Enter, Right, Right, Enter)

    await title('Maio de 2024')
    expect(await screen.findByText(MESSAGES.emptyMonth.title)).toBeTruthy()
  })

  it.each([
    [Enter, MESSAGES.noAlbums],
    [Right, MESSAGES.emptyTimeline],
  ])('should say the library is empty (%s)', async (key, text) => {
    const sut = show(
      memoryLibrary({
        ...DATA,
        albums: [],
        months: [],
        albumPhotos: new Map(),
        monthPhotos: new Map(),
      }),
    )
    await focusedOn(MESSAGES.albums)

    sut.remote.press(key, Enter)

    expect(await screen.findByText(text.title)).toBeTruthy()
    expect(screen.getByText(text.hint)).toBeTruthy()
  })

  it('should explain a failure, log it and try again on Enter', async () => {
    const error = new PhotoLibraryError(LibraryFailure.Unreachable, 'timeout')
    // The start screen reads the albums first, for the photo behind it.
    let attempts = 0
    const sut = show(
      stubLibrary({
        listAlbums: async () => {
          attempts += 1
          return attempts === 2 ? Promise.reject(error) : Promise.resolve([FAMILY])
        },
      }),
    )
    await focusedOn(MESSAGES.albums)
    sut.remote.press(Enter)

    expect((await screen.findByRole('alert')).textContent).toContain(
      failureText(LibraryFailure.Unreachable).title,
    )
    expect(sut.reported).toStrictEqual([error])
    await focusedOn(MESSAGES.retry)
    sut.remote.press(Enter)

    await focusedOn(FAMILY.name)
  })

  it('should go back while a screen loads and forget its answer', async () => {
    const pending: ((albums: readonly Album[]) => void)[] = []
    const sut = show(
      stubLibrary({
        listAlbums: async () =>
          new Promise((resolve) => {
            pending.push(resolve)
          }),
      }),
    )
    sut.remote.press(Enter)
    await title(MESSAGES.albums)

    sut.remote.press(Back)
    await title(MESSAGES.appName)
    expect(pending).toHaveLength(2)
    pending[1]?.([])
    await Promise.resolve()

    expect(screen.queryByText(MESSAGES.noAlbums.title)).toBeNull()
    await focusedOn(MESSAGES.albums)
  })

  it('should open a screen once when Enter arrives twice before it shows', async () => {
    const sut = show()
    await focusedOn(MESSAGES.albums)

    sut.remote.pressAtOnce(Enter, Enter)
    await focusedOn(TRIP.name)
    sut.remote.press(Back)

    await title(MESSAGES.appName)
  })

  it('should go back once when Back arrives twice before the screen changes', async () => {
    const sut = show()
    sut.remote.press(Enter)
    await focusedOn(TRIP.name)
    sut.remote.press(Enter)
    await title(TRIP.name)

    sut.remote.pressAtOnce(Back, Back)

    await focusedOn(TRIP.name)
  })

  it('should stay on the start screen on Back, Up and Left', async () => {
    const sut = show()
    await focusedOn(MESSAGES.albums)

    sut.remote.press(Back, Up, Left)

    await title(MESSAGES.appName)
    await focusedOn(MESSAGES.albums)
  })
})
