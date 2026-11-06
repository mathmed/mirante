import { screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mixedPhotos } from '../../test/book-photos.ts'
import {
  ALBUM_SOURCE,
  BOOK_ALBUM,
  elapse,
  focusedPhoto,
  pageNumbers,
  settled,
  showBook,
  shownPhotos,
} from '../../test/book.ts'
import { focused } from '../../test/gallery.ts'
import { bookLayouts, imageSizeOf, PageKind, spreadOfPhoto } from '../core/book.ts'
import { SourceKind } from '../core/presentation-source.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { MESSAGES } from './messages.ts'

const { Up, Down, Left, Right, Enter, Back } = RemoteKey
const SPREAD_MS = 5000
// With the seed of the tests, 33 photos make 13 pages: the last spread ends on a blank page.
const ODD_PAGES = 33
// The strip shows seven spreads; their pages are laid out one between two frames.
const STRIP_SPREADS = 7
const LAID_OUT_LATER = 14

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function stripLabels(): readonly (string | null)[] {
  return [...document.querySelectorAll('.book-strip-item')].map((item) =>
    item.getAttribute('aria-label'),
  )
}

function captionText(): string | null | undefined {
  return document.querySelector('.book-caption-text')?.textContent
}

describe('BookScreen', () => {
  it('should open on the cover, facing the first page, with its first photo in focus', async () => {
    showBook()
    await settled()

    expect(screen.getByRole('heading', { level: 1, name: BOOK_ALBUM.name })).toBeTruthy()
    expect(document.querySelector('.book-cover-title')?.textContent).toBe(BOOK_ALBUM.name)
    expect(document.querySelector('.book-cover-period')?.textContent).toBe('Março de 2024')
    expect(pageNumbers()).toStrictEqual(['', 'Página 1'])
    expect(shownPhotos()).toStrictEqual(['b-1', 'b-2', 'b-3'])
    expect(focusedPhoto()).toBe('b-1')
    expect(screen.getByText(MESSAGES.bookKeys)).toBeTruthy()
  })

  it('should load the thumbnail of a small photo and the preview of a large one', async () => {
    const sut = showBook()
    await settled()
    sut.remote.press(Down, Down, Down, Right, Right, Enter)

    const book = sut.book()
    const layouts = bookLayouts(book)
    const pages = [book.spreads[2]?.left, book.spreads[2]?.right]
    const sizes = pages.flatMap((page) =>
      page?.kind === PageKind.Photos ? layouts.layoutOf(page).frames.map(imageSizeOf) : [],
    )
    const sources = [...document.querySelectorAll('.spread.is-current .book-frame img')].map(
      (image) => image.getAttribute('src'),
    )
    expect(new Set(sizes).size).toBe(2)
    expect(sources).toStrictEqual(
      sizes.map((size, index) => `https://images.test/${size}/b-${String(index + 10)}`),
    )
  })

  it('should move among the photos with the arrows, and turn the page past the edge', async () => {
    const sut = showBook()
    await settled()

    sut.remote.press(Down)
    expect(focusedPhoto()).toBe('b-2')
    sut.remote.press(Down)
    expect(focused()).toBe(MESSAGES.bookOverview)
    sut.remote.press(Up, Right)
    expect(pageNumbers()).toStrictEqual(['Página 2', 'Página 3'])
    expect(focusedPhoto()).toBe('b-4')
    expect(document.querySelector('.spread.is-leaving')).toBeTruthy()

    sut.remote.press(Left)
    expect(pageNumbers()).toStrictEqual(['', 'Página 1'])
    expect(focusedPhoto()).toBe('b-3')
    sut.remote.press(Left)
    expect(focusedPhoto()).toBe('b-2')
    sut.remote.press(Up, Left, Up)
    expect(focusedPhoto()).toBe('b-1')
  })

  it('should never turn before the first spread or past the last one', async () => {
    const sut = showBook({ photos: mixedPhotos(3) })
    await settled()

    sut.remote.press(Left, Right, Right, Right)

    expect(pageNumbers()).toStrictEqual(['', 'Página 1'])
    expect(focusedPhoto()).toBe('b-1')
  })

  it('should turn the pages with the arrows of the bar', async () => {
    const sut = showBook()
    await settled()

    sut.remote.press(Down, Down, Right, Right, Right, Enter)
    expect(pageNumbers()).toStrictEqual(['Página 2', 'Página 3'])
    expect(focused()).toBe('›')

    sut.remote.press(Left, Left, Left, Left, Left, Enter)
    expect(focused()).toBe('‹')
    expect(pageNumbers()).toStrictEqual(['', 'Página 1'])
    sut.remote.press(Back)
    expect(focusedPhoto()).toBe('b-1')
  })

  it('should open the spread chosen on the strip, the one on the screen marked', async () => {
    const sut = showBook()
    await settled()

    sut.remote.press(Down, Down, Down)
    expect(focused()).toBe('')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Capa e página 1')
    expect(document.querySelector('.book-strip-item.is-current')).toBe(document.activeElement)
    sut.remote.press(Right, Right, Right, Left, Enter)

    expect(pageNumbers()).toStrictEqual(['Página 4', 'Página 5'])
    expect(focusedPhoto()).toBe('b-10')
    sut.remote.press(Down, Down, Up)
    expect(focused()).toBe(MESSAGES.bookOverview)
    sut.remote.press(Down, Back)
    expect(focusedPhoto()).toBe('b-10')
  })

  it('should name the spreads of the strip by their pages, the last one beside a blank page', async () => {
    const sut = showBook({ photos: mixedPhotos(ODD_PAGES) })
    await settled()

    expect(stripLabels().slice(0, 2)).toStrictEqual(['Capa e página 1', 'Páginas 2 e 3'])
    sut.remote.press(Down, Down, Down, ...Array<RemoteKey>(8).fill(Right), Enter)

    expect(pageNumbers()).toStrictEqual(['Página 12', ''])
    expect(document.querySelector('.spread.is-current .book-page.is-blank')).toBeTruthy()
    expect(stripLabels().slice(-1)).toStrictEqual(['Página 12'])
    expect(document.querySelectorAll('.book-strip .mini-page.is-blank')).toHaveLength(1)
  })

  it('should draw the miniatures of the strip once their pages are laid out', async () => {
    const sut = showBook()
    await settled()
    const miniatures = (): number => document.querySelectorAll('.book-strip .mini-photo').length
    const before = miniatures()

    for (let page = 0; page < LAID_OUT_LATER; page += 1) {
      await elapse(0)
    }

    const shown = sut.book().spreads.slice(0, STRIP_SPREADS)
    const photoCount = shown.reduce((count, spread) => count + spread.photos.length, 0)
    expect(before).toBeLessThan(photoCount)
    expect(miniatures()).toBe(photoCount)
    expect(document.querySelectorAll('.book-strip .mini-cover')).toHaveLength(1)
  })

  it('should open every spread from the overview, and close it on its button', async () => {
    const sut = showBook()
    await settled()

    sut.remote.press(Down, Down, Enter)
    const overview = screen.getByRole('dialog', { name: MESSAGES.bookOverview })
    expect(overview.querySelectorAll('.cell')).toHaveLength(sut.book().spreads.length)
    expect(screen.getByText(MESSAGES.bookOverviewKeys)).toBeTruthy()
    expect(focused()).toBe('Capa e página 1')
    sut.remote.press(Back)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(focused()).toBe(MESSAGES.bookOverview)

    sut.remote.press(Enter, Right, Down, Enter)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(pageNumbers()).toStrictEqual(['Página 10', 'Página 11'])
    expect(focusedPhoto()).toBe('b-26')
  })

  it('should open a photo full screen, and come back to the spread of the last one shown', async () => {
    const sut = showBook()
    await settled()
    sut.remote.press(Right, Enter)

    expect(screen.getByRole('dialog', { name: '4 de 40' })).toBeTruthy()
    expect(document.querySelector('.book')).toBeNull()
    sut.remote.press(Right, Right, Right, Right, Right, Right)
    expect(screen.getByRole('dialog', { name: '10 de 40' })).toBeTruthy()
    sut.remote.press(Back)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(pageNumbers()).toStrictEqual(['Página 4', 'Página 5'])
    expect(focusedPhoto()).toBe('b-10')
  })

  it('should play the book a spread at a time, with the time of a spread, until paused', async () => {
    const sut = showBook({ settings: { bookSpreadSeconds: 5, intervalSeconds: 60 } })
    await settled()
    sut.remote.press(Down, Down, Left)
    expect(focused()).toBe(MESSAGES.playBook)

    sut.remote.press(Enter)
    expect(focused()).toBe(MESSAGES.pauseBook)
    await elapse(SPREAD_MS)
    expect(pageNumbers()).toStrictEqual(['Página 2', 'Página 3'])
    await elapse(SPREAD_MS)
    expect(pageNumbers()).toStrictEqual(['Página 4', 'Página 5'])

    sut.remote.press(Enter)
    expect(focused()).toBe(MESSAGES.playBook)
    await elapse(SPREAD_MS)
    expect(pageNumbers()).toStrictEqual(['Página 4', 'Página 5'])
  })

  it('should hold the book while the overview is open', async () => {
    const sut = showBook({ settings: { bookSpreadSeconds: 5 } })
    await settled()
    sut.remote.press(Down, Down, Left, Enter, Right, Enter)

    await elapse(SPREAD_MS)
    await elapse(SPREAD_MS)

    expect(pageNumbers()).toStrictEqual(['', 'Página 1'])
    sut.remote.press(Back)
    await elapse(SPREAD_MS)
    expect(pageNumbers()).toStrictEqual(['Página 2', 'Página 3'])
  })

  it('should reorganize the book on the photos of the spread, with a new seed for the album', async () => {
    const sut = showBook()
    await settled()
    sut.remote.press(Down, Down, Down, Right, Right, Enter, Down, Right)
    expect(focused()).toBe(MESSAGES.reorganizeBook)
    const before = sut.book()

    sut.remote.press(Enter)

    const after = sut.book()
    expect(sut.reorganized).toStrictEqual(['album:walk'])
    expect(after.seed).not.toBe(before.seed)
    expect(after.spreads.map(({ photos }) => photos.length)).not.toStrictEqual(
      before.spreads.map(({ photos }) => photos.length),
    )
    const spread = after.spreads[spreadOfPhoto(after, 'b-10')]
    expect(shownPhotos()).toStrictEqual(spread?.photos.map(({ id }) => id))
    expect(focusedPhoto()).toBe('b-10')
  })

  it('should show the caption of the photo in focus, under the spread', async () => {
    const sut = showBook({ captions: new Map([['b-2', 'Neblina no vale']]) })
    await settled()
    expect(captionText()).toBeUndefined()

    sut.remote.press(Down)
    await settled()

    expect(focusedPhoto()).toBe('b-2')
    expect(captionText()).toBe('Neblina no vale')
    sut.remote.press(Down)
    await settled()
    expect(captionText()).toBeUndefined()
  })

  it('should leave the captions, the page numbers and the cover out when the settings say so', async () => {
    const sut = showBook({
      captions: new Map([['b-1', 'Neblina no vale']]),
      settings: {
        shouldShowCaption: false,
        shouldShowPageNumbers: false,
        shouldShowBookCover: false,
      },
    })
    await settled()

    expect(document.querySelector('.book-caption')).toBeNull()
    expect(document.querySelector('.book-cover')).toBeNull()
    expect(pageNumbers()).toStrictEqual(['', ''])
    expect(shownPhotos()).toStrictEqual(sut.book().spreads[0]?.photos.map(({ id }) => id))
    expect(stripLabels()[0]).toBe('Páginas 1 e 2')
  })

  it('should turn the pages by a crossfade alone when the effects are reduced', async () => {
    showBook({ settings: { shouldReduceEffects: true } })
    await settled()

    expect(document.querySelector('.book')?.classList.contains('is-calm')).toBe(true)
  })

  it('should open the book of a month, from its first day', async () => {
    const month = { key: 'm-2024-03', year: 2024, month: 3, photoCount: 3 }
    showBook({ source: { kind: SourceKind.Month, month } })
    await settled()

    expect(screen.getByRole('heading', { level: 1, name: 'Março de 2024' })).toBeTruthy()
    expect(document.querySelector('.book-cover-title')?.textContent).toBe('Março de 2024')
  })

  it('should say an album has no photos, and go back', async () => {
    const sut = showBook({ photos: [] })
    await settled()

    expect(screen.getByText(MESSAGES.emptyAlbum.title)).toBeTruthy()
    sut.remote.press(Enter)
    expect(sut.back).toHaveBeenCalledOnce()
  })

  it('should go back from the photos of the book', async () => {
    const sut = showBook({ source: ALBUM_SOURCE })
    await settled()

    sut.remote.press(Back)

    expect(sut.back).toHaveBeenCalledOnce()
  })
})
