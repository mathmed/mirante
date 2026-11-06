import { screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  focusedOn,
  KEY,
  onAlbumsCard,
  press,
  sources,
  startApp,
  stopApp,
  title,
} from '../test/app-page.ts'
import { serveConfig, serveLibrary, VALID_CONFIG } from '../test/fake-immich.ts'
import { SAMPLE_LIBRARY, TRIP, TRIP_PHOTOS } from '../test/sample-library.ts'
import { STORED_SEEDS_VERSION } from './core/book-seeds.ts'
import { BOOK_SEEDS_KEY, SETTINGS_KEY } from './platform/local-settings.ts'
import { MESSAGES } from './ui/messages.ts'

const {
  enter: ENTER,
  left: LEFT,
  right: RIGHT,
  up: UP,
  down: DOWN,
  escape: ESCAPE,
  info: INFO,
} = KEY
// Down goes from photo to photo, shows the controls below the last one (a page holds six photos
// at most), and goes on to the strip, where it stays; Up comes back to the overview button.
const TO_THE_OVERVIEW: readonly number[] = [...Array<number>(8).fill(DOWN), UP]
// The row of the format of the book in the settings, from the first one: the second of the book's,
// after the eight of the presentations.
const TO_THE_FORMAT: readonly number[] = Array<number>(9).fill(DOWN)
const SPREAD_SECONDS = 3
const MS_PER_SECOND = 1000
// The book plays a spread, then turns the page.
const PLAY_TIMEOUT_MS = 3 * SPREAD_SECONDS * MS_PER_SECOND
// The whole flow lays out every page of the strip: alone it takes a second or two, beside the rest
// of the suite under coverage, more than the default 5.
const FLOW_TIMEOUT_MS = 20_000

beforeEach(() => {
  vi.resetModules()
})

afterEach(stopApp)

function shownPages(): string | null | undefined {
  return document.querySelector('.book-layer-pages')?.textContent
}

async function showsPages(pages: string): Promise<void> {
  await waitFor(() => {
    expect(shownPages()).toBe(pages)
  })
}

function focusedSource(): string | null | undefined {
  return document.activeElement?.querySelector('img')?.getAttribute('src')
}

function isLayerShown(): boolean {
  return document.querySelector('.book-layer.is-shown') !== null
}

// The album of the trip, open as a book from the albums card, on the cover and its first page.
async function openTripBook(): Promise<void> {
  press(ENTER)
  await focusedOn(TRIP.name)
  press(ENTER)
  await title(TRIP.name)
  await waitFor(() => {
    expect(focusedSource()).toContain('trip-00')
  })
  press(LEFT)
  await focusedOn(MESSAGES.seeAsBook)
  press(ENTER)
  await showsPages('Capa e página 1')
}

async function startOnAlbums(): Promise<void> {
  serveConfig({ ...VALID_CONFIG, presentation: { bookSpreadSeconds: SPREAD_SECONDS } })
  serveLibrary(SAMPLE_LIBRARY)
  await startApp()
  await onAlbumsCard()
}

describe('a book, with the remote control', () => {
  it(
    'should open an album as a full screen book, turn its pages, move among its photos, open one and come back',
    async () => {
      await startOnAlbums()
      await openTripBook()

      expect(await screen.findByText('Pôr do sol na Torre de Belém')).toBeTruthy()
      expect(document.querySelector('.book-cover-title')?.textContent).toBe(TRIP.name)
      expect(document.querySelector<HTMLElement>('.book-sheet')?.style.paddingTop).toBe('56.25%')
      expect(sources().every((source) => /size=(thumbnail|preview)$/.test(source ?? ''))).toBe(true)
      expect(isLayerShown()).toBe(false)

      press(RIGHT)
      await showsPages('Páginas 2 e 3')
      const first = focusedSource()
      press(DOWN)
      await waitFor(() => {
        expect(focusedSource()).not.toBe(first)
      })
      const chosen = focusedSource() ?? ''
      expect(isLayerShown()).toBe(false)

      press(ENTER)
      const viewer = await screen.findByRole('dialog', {
        name: (name) => name.endsWith(` de ${String(TRIP_PHOTOS)}`),
      })
      expect(chosen).toContain(
        `trip-${String(Number.parseInt(viewer.getAttribute('aria-label') ?? '', 10) - 1).padStart(2, '0')}/`,
      )
      press(ESCAPE)
      await showsPages('Páginas 2 e 3')
      expect(focusedSource()).toBe(chosen)

      press(LEFT)
      await showsPages('Capa e página 1')
      press(ESCAPE)
      await title(TRIP.name)
      await focusedOn(MESSAGES.seeAsBook)
    },
    FLOW_TIMEOUT_MS,
  )

  it(
    'should show the controls over the book, open the overview, and hide them again',
    async () => {
      await startOnAlbums()
      await openTripBook()

      press(INFO)
      await focusedOn(MESSAGES.bookOverview)
      expect(isLayerShown()).toBe(true)
      press(ENTER)
      const overview = await screen.findByRole('dialog', { name: MESSAGES.bookOverview })
      expect(overview.textContent).toContain('Páginas 2 e 3')
      press(ESCAPE)
      await focusedOn(MESSAGES.bookOverview)

      press(ESCAPE)
      await waitFor(() => {
        expect(focusedSource()).toContain('trip-00')
      })
      expect(isLayerShown()).toBe(false)

      press(...TO_THE_OVERVIEW)
      await focusedOn(MESSAGES.bookOverview)
      press(RIGHT, RIGHT, ENTER)
      await showsPages('Páginas 2 e 3')
    },
    FLOW_TIMEOUT_MS,
  )

  it(
    'should play the book with its pages alone, pause it with a key, and reorganize it, kept on the TV',
    async () => {
      await startOnAlbums()
      await openTripBook()

      press(INFO, LEFT)
      await focusedOn(MESSAGES.playBook)
      press(ENTER)
      await waitFor(() => {
        expect(document.querySelector('.book.is-playing')).not.toBeNull()
      })
      expect(isLayerShown()).toBe(false)
      expect(document.querySelector('.book-progress-bar')).not.toBeNull()
      await waitFor(
        () => {
          expect(shownPages()).toBe('Páginas 2 e 3')
        },
        { timeout: PLAY_TIMEOUT_MS },
      )

      press(DOWN)
      await focusedOn(MESSAGES.playBook)
      expect(document.querySelector('.book.is-playing')).toBeNull()
      expect(isLayerShown()).toBe(true)

      press(RIGHT, RIGHT, ENTER)
      await waitFor(() => {
        expect(JSON.parse(window.localStorage.getItem(BOOK_SEEDS_KEY) ?? '{}')).toStrictEqual({
          version: STORED_SEEDS_VERSION,
          books: [[`album:${TRIP.id}`, expect.any(Number) as unknown]],
        })
      })
    },
    PLAY_TIMEOUT_MS * 2,
  )

  it(
    'should lay the book out in the format chosen in the settings, kept on the TV',
    async () => {
      await startOnAlbums()
      press(RIGHT, RIGHT, RIGHT, ENTER)
      await title(MESSAGES.settings)
      await focusedOn('Tempo de cada foto')
      press(...TO_THE_FORMAT)
      await focusedOn('Formato do livroTela cheia (16:9)')
      press(RIGHT)
      await focusedOn('Formato do livroClássico (4:3)')
      press(ESCAPE)
      await focusedOn(MESSAGES.settings)
      expect(window.localStorage.getItem(SETTINGS_KEY)).toContain('"bookFormat":"classic"')

      press(LEFT, LEFT, LEFT)
      await focusedOn('Álbuns')
      await openTripBook()

      expect(document.querySelector<HTMLElement>('.book-sheet')?.style.paddingTop).toBe('37.5%')
    },
    FLOW_TIMEOUT_MS,
  )
})
