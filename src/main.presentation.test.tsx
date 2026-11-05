import { screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { focusedOn, KEY, press, sources, startApp, stopApp, title } from '../test/app-page.ts'
import {
  fakeServer,
  IMMICH_URL,
  serveConfig,
  serveLibrary,
  VALID_CONFIG,
} from '../test/fake-immich.ts'
import { SAMPLE_LIBRARY, TRIP, TRIP_PHOTOS } from '../test/sample-library.ts'
import { MESSAGES } from './ui/messages.ts'

// The presentations and their settings, as the TV runs them, against the fake Immich server.
const API = `${IMMICH_URL}/api`

// The photos of the trip in their grid, ready for Enter.
async function openTrip(): Promise<void> {
  press(KEY.enter)
  await focusedOn(TRIP.name)
  press(KEY.enter)
  await title(TRIP.name)
  await waitFor(() => {
    expect(sources()).toHaveLength(TRIP_PHOTOS)
  })
}

function current(): string | null | undefined {
  return document.querySelector('.slide.is-current img')?.getAttribute('src')
}

function preview(id: string): string {
  return `${API}/assets/${id}/thumbnail?size=preview`
}

// The requests to Immich, by "<method> <path>", from now on.
function requests(): string[] {
  const calls: string[] = []
  fakeServer.events.on('request:start', ({ request }) => {
    calls.push(`${request.method} ${new URL(request.url).pathname}`)
  })
  return calls
}

beforeEach(async () => {
  vi.resetModules()
  serveConfig(VALID_CONFIG)
  serveLibrary(SAMPLE_LIBRARY)
  await startApp()
  await focusedOn(MESSAGES.albums)
})

afterEach(stopApp)

describe('the presentations', () => {
  it('should apply the settings changed with the remote control to the next presentation', async () => {
    press(KEY.right, KEY.right, KEY.right, KEY.enter)
    await title(MESSAGES.settings)
    await focusedOn('Tempo de cada foto8 s')
    press(KEY.right, KEY.right, KEY.down, KEY.right)
    await focusedOn('OrdemData decrescente')
    press(KEY.escape)
    await focusedOn(MESSAGES.settings)

    press(KEY.left, KEY.enter)
    await title(MESSAGES.present)
    press(KEY.right, KEY.enter)
    await title(MESSAGES.presentAlbum)
    await focusedOn(TRIP.name)
    press(KEY.enter)

    expect(await screen.findByRole('dialog', { name: `1 de ${String(TRIP_PHOTOS)}` })).toBeTruthy()
    expect(current()).toBe(preview('trip-13'))
    expect(
      document.querySelector<HTMLElement>('.viewer-progress-bar')?.style.animationDuration,
    ).toBe('10s')
    expect(JSON.parse(window.localStorage.getItem('mirante.presentation') ?? '{}')).toMatchObject({
      version: 1,
      settings: { intervalSeconds: 10, order: 'newest-first' },
    })
  })

  it('should show the caption written in Immich, reading the photo and the next one only', async () => {
    await openTrip()
    const calls = requests()
    press(KEY.enter)

    expect(await screen.findByText('Pôr do sol na Torre de Belém')).toBeTruthy()
    await waitFor(() => {
      expect(
        calls.filter((call) => call.startsWith('GET /api/assets/') && !call.endsWith('/thumbnail')),
      ).toStrictEqual(['GET /api/assets/trip-00', 'GET /api/assets/trip-01'])
    })
  })

  it('should open the settings over the viewer with Info, and keep them on Back', async () => {
    await openTrip()
    press(KEY.enter)
    await screen.findByRole('dialog')

    press(KEY.info)
    expect(await screen.findByRole('heading', { level: 2, name: MESSAGES.settings })).toBeTruthy()
    press(KEY.down, KEY.down, KEY.right, KEY.webOsBack)

    await waitFor(() => {
      expect(document.activeElement?.getAttribute('role')).toBe('dialog')
    })
    expect(window.localStorage.getItem('mirante.presentation')).toContain('"transition":"slide"')
    expect(document.querySelector('.slide.is-current')?.className).toBe(
      'slide slide-slide is-current',
    )
  })

  it('should present the whole library from a random draw of Immich', async () => {
    const calls = requests()
    press(KEY.right, KEY.right, KEY.enter)
    await title(MESSAGES.present)
    press(KEY.enter)

    expect(
      await screen.findByRole('dialog', { name: `1 de ${String(TRIP_PHOTOS + 1)}` }),
    ).toBeTruthy()
    expect(calls).toContain('POST /api/search/random')
    press(KEY.tizenBack)
    await focusedOn('Toda a biblioteca')
  })
})
