import { screen, waitFor } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { DATA, focusedOn, showGallery, type ShownGallery, title } from '../../test/gallery.ts'
import { memoryLibrary, photos, stubLibrary } from '../../test/library-stub.ts'
import { ScreenKind } from '../core/navigation.ts'
import {
  LibraryFailure,
  type Photo,
  type PhotoLibrary,
  PhotoLibraryError,
  type TimelineMonth,
} from '../core/photo-library.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { failureText, homeTitle, MESSAGES } from './messages.ts'

const { Up, Down, Left, Right, Enter, Back, Info } = RemoteKey
const UNREACHABLE = new PhotoLibraryError(LibraryFailure.Unreachable, 'timeout')

// The gallery opened on every photo. Its library in memory has April 2024 (2 photos) and March
// 2024 (10), the most recent first, and two months without photos.
async function allPhotos(library?: PhotoLibrary): Promise<ShownGallery> {
  const sut = showGallery(library === undefined ? {} : { library })
  await focusedOn(homeTitle(ScreenKind.AllPhotos))
  sut.remote.press(Enter)
  await title(MESSAGES.allPhotosTitle)
  return sut
}

function focusedPhoto(): string | null | undefined {
  return document.activeElement?.querySelector('img')?.getAttribute('src')
}

async function focusedOnPhoto(id: string): Promise<void> {
  await waitFor(() => {
    expect(focusedPhoto()).toBe(`https://images.test/thumbnail/${id}`)
  })
}

function thumbnails(): (string | null)[] {
  return [...document.querySelectorAll('.feed img')].map((image) => image.getAttribute('src'))
}

function month(number: number, photoCount: number): TimelineMonth {
  return { key: `m-${String(number)}`, year: 2020, month: number, photoCount }
}

// A library of months of 20 photos each, from January 2020, that counts the months it reads.
function longLibrary(count: number, reads: string[]): PhotoLibrary {
  const months = [...Array(count).keys()].map((index) => month(index + 1, 20))
  return stubLibrary({
    listAlbums: async () => Promise.resolve([]),
    listTimelineMonths: async () => Promise.resolve(months),
    listMonthPhotos: async (read) => {
      reads.push(read.key)
      return Promise.resolve(photos(read.key, 20, { year: 2020, month: read.month }))
    },
  })
}

describe('AllPhotosScreen', () => {
  it('should show every photo, the most recent first, under the heading of each month', async () => {
    await allPhotos()

    await focusedOnPhoto('april-2')
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toStrictEqual(['Abril de 2024', 'Março de 2024'])
    expect(screen.getByText('2 fotos')).toBeTruthy()
    expect(screen.getByText('10 fotos')).toBeTruthy()
    expect(thumbnails().slice(0, 4)).toStrictEqual([
      'https://images.test/thumbnail/april-2',
      'https://images.test/thumbnail/april-1',
      'https://images.test/thumbnail/march-10',
      'https://images.test/thumbnail/march-9',
    ])
    expect(screen.getByText(MESSAGES.allPhotosKeys)).toBeTruthy()
  })

  it('should move across the rows and the months with the arrows', async () => {
    const sut = await allPhotos()
    await focusedOnPhoto('april-2')

    sut.remote.press(Down)
    await focusedOnPhoto('march-10')
    sut.remote.press(Right, Down)
    await focusedOnPhoto('march-3')
    sut.remote.press(Up, Left, Left)
    await focusedOnPhoto('april-1')
    sut.remote.press(Up)

    await focusedOnPhoto('april-1')
  })

  it('should open the viewer across the months, and come back to the photo it showed last', async () => {
    const sut = await allPhotos()
    await focusedOnPhoto('april-2')

    sut.remote.press(Right, Enter)
    expect(await screen.findByRole('dialog', { name: '2 de 12' })).toBeTruthy()
    sut.remote.press(Right)
    expect(await screen.findByRole('dialog', { name: '3 de 12' })).toBeTruthy()
    expect(document.querySelector('.viewer')?.classList.contains('is-playing')).toBe(false)
    sut.remote.press(Back)

    await focusedOnPhoto('march-10')
    sut.remote.press(Back)
    await focusedOn(homeTitle(ScreenKind.AllPhotos))
  })

  it('should present from the photo in focus on Info, in the order of the screen', async () => {
    const sut = await allPhotos()
    await focusedOnPhoto('april-2')

    sut.remote.press(Down, Right, Info)

    expect(await screen.findByRole('dialog', { name: '4 de 12' })).toBeTruthy()
    expect(document.querySelector('.viewer')?.classList.contains('is-playing')).toBe(true)
    sut.remote.press(Back)
    await focusedOnPhoto('march-9')
  })

  it('should read the months from the most recent, only as the focus comes near the end', async () => {
    const reads: string[] = []
    const sut = await allPhotos(longLibrary(6, reads))
    await focusedOnPhoto('m-6-20')
    expect(reads).toStrictEqual(['m-6', 'm-5'])

    sut.remote.press(Down)
    await waitFor(() => {
      expect(reads).toStrictEqual(['m-6', 'm-5', 'm-4'])
    })

    // Only the rows on the screen and those around them: never every photo read.
    expect(thumbnails().length).toBeLessThan(40)
  })

  it('should read the next month ahead of the viewer, and go on into it', async () => {
    const reads: string[] = []
    const sut = await allPhotos(longLibrary(3, reads))
    await focusedOnPhoto('m-3-20')
    sut.remote.press(Enter)
    expect(await screen.findByRole('dialog', { name: '1 de 40' })).toBeTruthy()

    sut.remote.press(Right, Right, Right, Right)

    expect(await screen.findByRole('dialog', { name: '5 de 60' })).toBeTruthy()
    expect(reads).toStrictEqual(['m-3', 'm-2', 'm-1'])
  })

  it('should say it is loading while the first month comes', async () => {
    await allPhotos(
      stubLibrary({
        listAlbums: async () => Promise.resolve([]),
        listTimelineMonths: async () => Promise.resolve([month(1, 1)]),
        listMonthPhotos: async () => new Promise(() => undefined),
      }),
    )

    expect((await screen.findByRole('status')).textContent).toBe(MESSAGES.loading)
  })

  it('should say the timeline is empty when its months hold videos only', async () => {
    const sut = await allPhotos(
      memoryLibrary({ ...DATA, months: [month(1, 2), month(2, 1)], monthPhotos: new Map() }),
    )

    expect(await screen.findByText(MESSAGES.emptyTimeline.title)).toBeTruthy()
    await focusedOn(MESSAGES.back)
    sut.remote.press(Enter)
    await focusedOn(homeTitle(ScreenKind.AllPhotos))
  })

  it('should explain a first month that fails, log it and try again on Enter', async () => {
    let attempts = 0
    const sut = await allPhotos(
      stubLibrary({
        listAlbums: async () => Promise.resolve([]),
        listTimelineMonths: async () => Promise.resolve([month(1, 1)]),
        listMonthPhotos: async () => {
          attempts += 1
          return attempts === 1 ? Promise.reject(UNREACHABLE) : Promise.resolve(photos('m', 1))
        },
      }),
    )

    expect((await screen.findByRole('alert')).textContent).toContain(
      failureText(LibraryFailure.Unreachable).title,
    )
    expect(sut.reported).toContain(UNREACHABLE)
    await focusedOn(MESSAGES.retry)
    sut.remote.press(Enter)

    await focusedOnPhoto('m-1')
  })

  it('should say when more photos cannot be read, and try again on the next move', async () => {
    let attempts = 0
    const many = photos('new', 40, { year: 2020, month: 2 })
    const older: readonly Photo[] = photos('old', 1, { year: 2020, month: 1 })
    const sut = await allPhotos(
      stubLibrary({
        listAlbums: async () => Promise.resolve([]),
        listTimelineMonths: async () => Promise.resolve([month(1, 1), month(2, 40)]),
        listMonthPhotos: async (read) => {
          if (read.month === 2) {
            return Promise.resolve(many)
          }
          attempts += 1
          return attempts === 1 ? Promise.reject(UNREACHABLE) : Promise.resolve(older)
        },
      }),
    )
    await focusedOnPhoto('new-40')

    sut.remote.press(Down)

    expect(await screen.findByText(MESSAGES.morePhotosFailed)).toBeTruthy()
    expect(sut.reported).toContain(UNREACHABLE)
    sut.remote.press(Down)
    expect(await screen.findByText(MESSAGES.allPhotosKeys)).toBeTruthy()
    expect(attempts).toBe(2)
  })
})
