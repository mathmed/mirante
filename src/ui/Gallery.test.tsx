import { screen, waitFor } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import {
  DATA,
  EMPTY,
  FAMILY,
  focusedOn,
  showGallery,
  type ShownGallery,
  title,
  TRIP,
} from '../../test/gallery.ts'
import { memoryLibrary, stubLibrary } from '../../test/library-stub.ts'
import { ScreenKind } from '../core/navigation.ts'
import {
  type Album,
  LibraryFailure,
  type PhotoLibrary,
  PhotoLibraryError,
} from '../core/photo-library.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { failureText, homeTitle, MESSAGES } from './messages.ts'

const { Up, Down, Left, Right, Enter, Back } = RemoteKey
const ALL_PHOTOS = homeTitle(ScreenKind.AllPhotos)

const show = (library?: PhotoLibrary): ShownGallery =>
  showGallery(library === undefined ? {} : { library })

describe('Gallery', () => {
  it('should start on the ways into the library and its presentations, with the server below them', async () => {
    show()

    await title(MESSAGES.appName)
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
      ALL_PHOTOS,
      MESSAGES.albums,
      MESSAGES.timeline,
      MESSAGES.present,
      MESSAGES.settings,
    ])
    expect(screen.getByText('Immich 3.3.6 em 192.168.0.10:2283')).toBeTruthy()
    await focusedOn(ALL_PHOTOS)
    // December 2023 counts its video, as Immich does.
    expect(await screen.findByText('13 fotos · de 2023 a 2024')).toBeTruthy()
  })

  it('should leave the line of the library out when its months cannot be read', async () => {
    const sut = show(stubLibrary({ listAlbums: async () => Promise.resolve([]) }))
    await focusedOn(ALL_PHOTOS)

    // The line and the search of the photo behind the screen each log the failed read.
    await waitFor(() => {
      expect(sut.reported).toHaveLength(2)
    })
    expect(document.querySelector('.home-summary')).toBeNull()
  })

  it('should leave the app on Back from the start screen', async () => {
    const sut = show()
    await focusedOn(ALL_PHOTOS)

    sut.remote.press(Back)

    expect(sut.leave).toHaveBeenCalledOnce()
  })

  it('should go back one screen, not leave the app, on Back from a deeper screen', async () => {
    const sut = show()
    sut.remote.press(Right, Enter)
    await title(MESSAGES.albums)

    sut.remote.press(Back)

    await focusedOn(MESSAGES.albums)
    expect(sut.leave).not.toHaveBeenCalled()
  })

  it('should not leave the app on a double Back that reaches the start screen', async () => {
    const sut = show()
    sut.remote.press(Right, Enter)
    await title(MESSAGES.albums)

    sut.remote.pressAtOnce(Back, Back)

    await focusedOn(MESSAGES.albums)
    expect(sut.leave).not.toHaveBeenCalled()
  })

  it('should list the albums with their covers and counts, the most recent first', async () => {
    const sut = show()

    sut.remote.press(Right, Enter)

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

    sut.remote.press(Right, Enter)

    await title(MESSAGES.albums)
    expect(screen.getByRole('status').textContent).toBe(MESSAGES.loading)
  })

  it('should open an album, a photo, and come back to where the focus was at each step', async () => {
    const sut = show()
    sut.remote.press(Right, Enter)
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
    sut.remote.press(Right, Enter)
    await focusedOn(TRIP.name)

    sut.remote.press(Right, Enter)
    await title(FAMILY.name)
    sut.remote.press(Back)

    await focusedOn(FAMILY.name)
  })

  it('should say an album is empty and go back from it', async () => {
    const sut = show()
    sut.remote.press(Right, Enter)
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
    await focusedOn(ALL_PHOTOS)

    sut.remote.press(Right, Right, Enter)
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
    await focusedOn(ALL_PHOTOS)
    sut.remote.press(Right, Right, Enter)
    await focusedOn('2024')

    sut.remote.press(Enter, Right, Right, Enter)

    await title('Maio de 2024')
    expect(await screen.findByText(MESSAGES.emptyMonth.title)).toBeTruthy()
  })

  it.each([
    { screen: MESSAGES.albums, keys: [Right], text: MESSAGES.noAlbums },
    { screen: MESSAGES.timeline, keys: [Right, Right], text: MESSAGES.emptyTimeline },
    { screen: ALL_PHOTOS, keys: [], text: MESSAGES.emptyTimeline },
  ])('should say the library is empty ($screen)', async ({ keys, text }) => {
    const sut = show(
      memoryLibrary({
        ...DATA,
        albums: [],
        months: [],
        albumPhotos: new Map(),
        monthPhotos: new Map(),
      }),
    )
    await focusedOn(ALL_PHOTOS)
    expect(document.querySelector('.home-summary')).toBeNull()

    sut.remote.press(...keys, Enter)

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
        listTimelineMonths: async () => Promise.resolve([]),
      }),
    )
    await focusedOn(ALL_PHOTOS)
    await waitFor(() => {
      expect(attempts).toBe(1)
    })
    sut.remote.press(Right, Enter)

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
    sut.remote.press(Right, Enter)
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
    sut.remote.press(Right)
    await focusedOn(MESSAGES.albums)

    sut.remote.pressAtOnce(Enter, Enter)
    await focusedOn(TRIP.name)
    sut.remote.press(Back)

    await title(MESSAGES.appName)
  })

  it('should go back once when Back arrives twice before the screen changes', async () => {
    const sut = show()
    sut.remote.press(Right, Enter)
    await focusedOn(TRIP.name)
    sut.remote.press(Enter)
    await title(TRIP.name)

    sut.remote.pressAtOnce(Back, Back)

    await focusedOn(TRIP.name)
  })

  it('should stay on the start screen on Back, Up and Left', async () => {
    const sut = show()
    await focusedOn(ALL_PHOTOS)

    sut.remote.press(Back, Up, Left)

    await title(MESSAGES.appName)
    await focusedOn(ALL_PHOTOS)
  })
})
