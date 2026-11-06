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
import { BOOK_SEEDS_KEY } from './platform/local-settings.ts'
import { MESSAGES } from './ui/messages.ts'

const { enter: ENTER, left: LEFT, right: RIGHT, up: UP, down: DOWN, escape: ESCAPE } = KEY
// Down reaches the bar under the spread, then the strip, whatever the layout of the page, and stays
// there; Up comes back to the overview, in the middle of the bar.
const TO_THE_OVERVIEW: readonly number[] = [DOWN, DOWN, DOWN, DOWN, DOWN, DOWN, UP]
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

function pageNumbers(): readonly (string | null)[] {
  return [...document.querySelectorAll('.book-number')].map((number) => number.textContent)
}

async function showsPages(...numbers: readonly string[]): Promise<void> {
  await waitFor(() => {
    expect(pageNumbers()).toStrictEqual(numbers)
  })
}

// The album of the trip, open as a book, on the cover and its first page.
async function openTripBook(): Promise<void> {
  serveConfig({ ...VALID_CONFIG, presentation: { bookSpreadSeconds: SPREAD_SECONDS } })
  serveLibrary(SAMPLE_LIBRARY)
  await startApp()
  await onAlbumsCard()
  press(ENTER)
  await focusedOn(TRIP.name)
  press(ENTER)
  await title(TRIP.name)
  await waitFor(() => {
    expect(document.activeElement?.querySelector('img')?.getAttribute('src')).toContain('trip-00')
  })
  press(LEFT)
  await focusedOn(MESSAGES.seeAsBook)
  press(ENTER)
  await showsPages('', 'Página 1')
}

describe('a book, with the remote control', () => {
  it(
    'should open an album as a book, turn its pages, open a photo and come back',
    async () => {
      await openTripBook()

      expect(await screen.findByText('Pôr do sol na Torre de Belém')).toBeTruthy()
      expect(document.querySelector('.book-cover-title')?.textContent).toBe(TRIP.name)
      expect(sources().every((source) => /size=(thumbnail|preview)$/.test(source ?? ''))).toBe(true)

      press(...TO_THE_OVERVIEW, RIGHT, RIGHT, ENTER)
      await showsPages('Página 2', 'Página 3')
      press(LEFT, LEFT, ENTER)
      const overview = await screen.findByRole('dialog', { name: MESSAGES.bookOverview })
      expect(overview.textContent).toContain('Páginas 2 e 3')
      press(ESCAPE)
      await focusedOn(MESSAGES.bookOverview)

      press(UP, ENTER)
      const viewer = await screen.findByRole('dialog', {
        name: (name) => name.endsWith(` de ${String(TRIP_PHOTOS)}`),
      })
      const opened = Number.parseInt(viewer.getAttribute('aria-label') ?? '', 10)
      press(ESCAPE)
      await showsPages('Página 2', 'Página 3')
      expect(document.activeElement?.querySelector('img')?.getAttribute('src')).toContain(
        `trip-${String(opened - 1).padStart(2, '0')}/`,
      )

      press(ESCAPE)
      await title(TRIP.name)
      await focusedOn(MESSAGES.seeAsBook)
    },
    FLOW_TIMEOUT_MS,
  )

  it(
    'should play the book a spread at a time, and reorganize it, kept on the TV',
    async () => {
      await openTripBook()

      press(...TO_THE_OVERVIEW, LEFT, ENTER)
      await focusedOn(MESSAGES.pauseBook)
      await waitFor(
        () => {
          expect(pageNumbers()).toStrictEqual(['Página 2', 'Página 3'])
        },
        { timeout: PLAY_TIMEOUT_MS },
      )
      press(ENTER)
      await focusedOn(MESSAGES.playBook)

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
})
