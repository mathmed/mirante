import { screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mixedPhotos } from '../../test/book-photos.ts'
import {
  ALBUM_SOURCE,
  BOOK_ALBUM,
  elapse,
  focusedPhoto,
  folios,
  isLayerShown,
  settled,
  showBook,
  shownPages,
  shownPhotos,
} from '../../test/book.ts'
import { focused } from '../../test/gallery.ts'
import { BookFormat } from '../core/book-geometry.ts'
import { bookLayouts, imageSizeOf, PageKind, spreadAt } from '../core/book.ts'
import { SourceKind } from '../core/presentation-source.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { MESSAGES } from './messages.ts'

const { Up, Down, Left, Right, Enter, Back, Info } = RemoteKey
// The interface hides 4 s after the last key, by default.
const HIDE_MS = 4000

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function captionText(): string | null | undefined {
  return document.querySelector('.book-caption-text')?.textContent
}

// How high the spread is, in a share of its width: the padding of its sheet.
function sheetHeight(): string | undefined {
  return document.querySelector<HTMLElement>('.book-sheet')?.style.paddingTop
}

describe('BookScreen', () => {
  it('should open full screen on the cover, facing the first page, its first photo in focus', async () => {
    showBook()
    await settled()

    expect(screen.getByRole('heading', { level: 1, name: BOOK_ALBUM.name })).toBeTruthy()
    expect(document.querySelector('.book-cover-title')?.textContent).toBe(BOOK_ALBUM.name)
    expect(document.querySelector('.book-cover-period')?.textContent).toBe('Março de 2024')
    expect(shownPhotos()).toStrictEqual(['b-1', 'b-2', 'b-3'])
    expect(focusedPhoto()).toBe('b-1')
    expect(folios()).toStrictEqual(['1'])
    expect(document.querySelector('.book-page.is-right .book-folio')).toBeTruthy()
    expect(isLayerShown()).toBe(false)
    expect(document.querySelector('.book-layer')?.getAttribute('aria-hidden')).toBe('true')
    expect(document.querySelector('.book-layer-title')?.textContent).toBe(BOOK_ALBUM.name)
    expect(shownPages()).toBe('Capa e página 1')
  })

  it('should lay a full screen book out in pages of 8:9, two of them 16:9', async () => {
    showBook()
    await settled()

    expect(sheetHeight()).toBe('56.25%')
    expect(document.querySelector('.mini-sheet')?.getAttribute('style')).toContain('56.25%')
    expect(document.querySelector('.mini-spread')?.getAttribute('style')).toContain(
      '--spread-aspect: 1.77',
    )
  })

  it('should lay a classic book out in pages of 4:3', async () => {
    const sut = showBook({ settings: { bookFormat: BookFormat.Classic } })
    await settled()

    expect(sheetHeight()).toBe('37.5%')
    expect(sut.book().pageAspect).toBeCloseTo(4 / 3, 12)
  })

  it('should load the thumbnail of a small photo and the preview of a large one', async () => {
    const sut = showBook()
    await settled()
    const book = sut.book()
    const layouts = bookLayouts(book)
    const sizesOf = (index: number): readonly string[] =>
      [spreadAt(book, index)?.left, spreadAt(book, index)?.right].flatMap((page) =>
        page?.kind === PageKind.Photos
          ? layouts.layoutOf(page).frames.map((frame) => imageSizeOf(frame, book.pageAspect))
          : [],
      )
    sut.remote.press(Right)

    const sources = [...document.querySelectorAll('.spread.is-current .book-frame img')].map(
      (image) => image.getAttribute('src'),
    )
    expect(new Set(sizesOf(1)).size).toBe(2)
    expect(sources).toStrictEqual(
      sizesOf(1).map((size, index) => `https://images.test/${size}/b-${String(index + 4)}`),
    )
  })

  it('should turn the page with left and right, from any photo, on the first photo', async () => {
    const sut = showBook()
    await settled()

    sut.remote.press(Down, Down, Right)
    expect(shownPages()).toBe('Páginas 2 e 3')
    expect(folios()).toStrictEqual(['2', '3'])
    expect(focusedPhoto()).toBe('b-4')
    expect(document.querySelector('.spread.is-leaving')).toBeTruthy()

    sut.remote.press(Down, Left)
    expect(shownPages()).toBe('Capa e página 1')
    expect(focusedPhoto()).toBe('b-1')
    expect(isLayerShown()).toBe(false)
  })

  it('should never turn before the first spread or past the last one', async () => {
    const sut = showBook({ photos: mixedPhotos(3) })
    await settled()

    sut.remote.press(Left, Right, Right, Right)

    expect(shownPages()).toBe('Capa e página 1')
    expect(focusedPhoto()).toBe('b-1')
  })

  it('should move among the photos with up and down, and show the controls below the last', async () => {
    const sut = showBook()
    await settled()

    sut.remote.press(Down)
    expect(focusedPhoto()).toBe('b-2')
    sut.remote.press(Down)
    expect(focusedPhoto()).toBe('b-3')
    sut.remote.press(Up, Up, Up)
    expect(focusedPhoto()).toBe('b-1')

    sut.remote.press(Down, Down, Down)
    expect(isLayerShown()).toBe(true)
    expect(focused()).toBe(MESSAGES.bookOverview)
    expect(document.querySelector('.book-layer')?.getAttribute('aria-hidden')).toBe('false')
    sut.remote.press(Up)
    expect(isLayerShown()).toBe(false)
    expect(focusedPhoto()).toBe('b-3')
  })

  it('should show the controls with Info, and hide them with Info or Back', async () => {
    const sut = showBook()
    await settled()

    sut.remote.press(Down, Info)
    expect(isLayerShown()).toBe(true)
    expect(focused()).toBe(MESSAGES.bookOverview)
    sut.remote.press(Info)
    expect(focusedPhoto()).toBe('b-2')

    sut.remote.press(Info, Down, Back)
    expect(isLayerShown()).toBe(false)
    expect(focusedPhoto()).toBe('b-2')
    expect(sut.back).not.toHaveBeenCalled()
  })

  it('should hide the controls by themselves after the time of the settings, from the last key', async () => {
    const sut = showBook({ settings: { hideInterfaceSeconds: 4 } })
    await settled()
    sut.remote.press(Info)

    await elapse(HIDE_MS - 1000)
    sut.remote.press(Right)
    await elapse(HIDE_MS - 1000)
    expect(isLayerShown()).toBe(true)
    expect(focused()).toBe(MESSAGES.reorganizeBook)

    await elapse(1000)
    expect(isLayerShown()).toBe(false)
    expect(focusedPhoto()).toBe('b-1')
  })

  it('should open a photo full screen, and come back to the spread of the last one shown', async () => {
    const sut = showBook()
    await settled()
    sut.remote.press(Right, Down, Enter)

    expect(screen.getByRole('dialog', { name: '6 de 40' })).toBeTruthy()
    expect(document.querySelector('.book')).toBeNull()
    sut.remote.press(Right, Right, Right, Right, Right, Right)
    expect(screen.getByRole('dialog', { name: '12 de 40' })).toBeTruthy()
    sut.remote.press(Back)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(shownPages()).toBe('Páginas 4 e 5')
    expect(focusedPhoto()).toBe('b-12')
    expect(isLayerShown()).toBe(false)
  })

  it('should show the caption of the photo in focus over the book', async () => {
    const sut = showBook({ captions: new Map([['b-2', 'Neblina no vale']]) })
    await settled()
    expect(captionText()).toBeUndefined()

    sut.remote.press(Down)
    await settled()

    expect(focusedPhoto()).toBe('b-2')
    expect(captionText()).toBe('Neblina no vale')
    sut.remote.press(Info)
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
    expect(folios()).toStrictEqual([])
    expect(shownPhotos()).toStrictEqual(sut.book().spreads[0]?.photos.map(({ id }) => id))
    expect(shownPages()).toBe('Páginas 1 e 2')
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

  it('should leave the book with Back while the controls are hidden', async () => {
    const sut = showBook({ source: ALBUM_SOURCE })
    await settled()

    sut.remote.press(Back)

    expect(sut.back).toHaveBeenCalledOnce()
  })
})
