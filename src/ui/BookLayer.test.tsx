import { screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mixedPhotos } from '../../test/book-photos.ts'
import {
  elapse,
  focusedPhoto,
  isLayerShown,
  settled,
  showBook,
  shownPages,
  shownPhotos,
} from '../../test/book.ts'
import { focused } from '../../test/gallery.ts'
import { spreadOfPhoto } from '../core/book.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { MESSAGES } from './messages.ts'

const { Up, Down, Left, Right, Enter, Back, Info } = RemoteKey
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

function isPlaying(): boolean {
  return document.querySelector('.book')?.classList.contains('is-playing') ?? false
}

describe('the controls of a book', () => {
  it('should turn the pages with the arrows of the bar, the controls still shown', async () => {
    const sut = showBook()
    await settled()

    sut.remote.press(Info, Right, Right, Enter)
    expect(shownPages()).toBe('Páginas 2 e 3')
    expect(focused()).toBe('›')
    expect(isLayerShown()).toBe(true)
    sut.remote.press(Left, Left, Left, Left, Left, Enter)
    expect(focused()).toBe('‹')
    expect(shownPages()).toBe('Capa e página 1')
    sut.remote.press(Back)
    expect(focusedPhoto()).toBe('b-1')
  })

  it('should open the spread chosen on the strip, the one on the screen marked', async () => {
    const sut = showBook()
    await settled()

    sut.remote.press(Info, Down)
    expect(focused()).toBe('')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Capa e página 1')
    expect(document.querySelector('.book-strip-item.is-current')).toBe(document.activeElement)
    sut.remote.press(Right, Right, Right, Left, Enter)

    expect(shownPages()).toBe('Páginas 4 e 5')
    expect(focusedPhoto()).toBe('b-10')
    expect(isLayerShown()).toBe(false)
    sut.remote.press(Info, Down, Up)
    expect(focused()).toBe(MESSAGES.bookOverview)
    sut.remote.press(Down, Back)
    expect(focusedPhoto()).toBe('b-10')
  })

  it('should name the spreads of the strip by their pages, the last one beside a blank page', async () => {
    const sut = showBook({ photos: mixedPhotos(ODD_PAGES) })
    await settled()

    expect(stripLabels().slice(0, 2)).toStrictEqual(['Capa e página 1', 'Páginas 2 e 3'])
    sut.remote.press(Info, Down, ...Array<RemoteKey>(8).fill(Right), Enter)

    expect(shownPages()).toBe('Página 12')
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

    sut.remote.press(Info, Enter)
    const overview = screen.getByRole('dialog', { name: MESSAGES.bookOverview })
    expect(overview.querySelectorAll('.cell')).toHaveLength(sut.book().spreads.length)
    expect(screen.getByText(MESSAGES.bookOverviewKeys)).toBeTruthy()
    expect(focused()).toBe('Capa e página 1')
    await elapse(10_000)
    sut.remote.press(Back)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(focused()).toBe(MESSAGES.bookOverview)
    expect(isLayerShown()).toBe(true)

    sut.remote.press(Enter, Right, Down, Enter)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(shownPages()).toBe('Páginas 10 e 11')
    expect(focusedPhoto()).toBe('b-26')
    expect(isLayerShown()).toBe(false)
  })

  it('should play the book with nothing over its pages but a line, until a key pauses it', async () => {
    const sut = showBook({
      settings: { bookSpreadSeconds: 5, intervalSeconds: 60 },
      captions: new Map([['b-1', 'Neblina no vale']]),
    })
    await settled()
    sut.remote.press(Info, Left)
    expect(focused()).toBe(MESSAGES.playBook)

    sut.remote.press(Enter)
    await settled()
    expect(isPlaying()).toBe(true)
    expect(isLayerShown()).toBe(false)
    expect(document.querySelector('.book-caption')).toBeNull()
    expect(document.querySelector('.book-progress-bar')?.getAttribute('style')).toContain('5s')
    await elapse(SPREAD_MS)
    expect(shownPages()).toBe('Páginas 2 e 3')
    await elapse(SPREAD_MS)
    expect(shownPages()).toBe('Páginas 4 e 5')

    sut.remote.press(Right)
    expect(isPlaying()).toBe(false)
    expect(isLayerShown()).toBe(true)
    expect(focused()).toBe(MESSAGES.playBook)
    expect(document.querySelector('.book-progress')).toBeNull()
    await elapse(SPREAD_MS)
    expect(shownPages()).toBe('Páginas 4 e 5')
  })

  it('should leave the book with Back while it plays', async () => {
    const sut = showBook({ settings: { bookSpreadSeconds: 5 } })
    await settled()
    sut.remote.press(Info, Left, Enter)

    sut.remote.press(Back)

    expect(sut.back).toHaveBeenCalledOnce()
  })

  it('should hold the book while the overview is open', async () => {
    const sut = showBook({ settings: { bookSpreadSeconds: 5 } })
    await settled()
    sut.remote.press(Info, Left, Enter, Up, Right, Enter)
    expect(screen.getByRole('dialog', { name: MESSAGES.bookOverview })).toBeTruthy()

    await elapse(SPREAD_MS)
    await elapse(SPREAD_MS)

    expect(shownPages()).toBe('Capa e página 1')
    sut.remote.press(Back, Left, Enter)
    await elapse(SPREAD_MS)
    expect(shownPages()).toBe('Páginas 2 e 3')
  })

  it('should reorganize the book on the photos of the spread, with a new seed for the album', async () => {
    const sut = showBook()
    await settled()
    sut.remote.press(Right, Right, Info, Right)
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
    expect(isLayerShown()).toBe(false)
  })
})
