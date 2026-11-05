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
import { SAMPLE_LIBRARY } from '../test/sample-library.ts'
import { MESSAGES } from './ui/messages.ts'

// Every photo of the library, as the TV runs it, against the fake Immich server.
const API = `${IMMICH_URL}/api`

function thumbnail(id: string): string {
  return `${API}/assets/${id}/thumbnail?size=thumbnail`
}

async function focusedOnPhoto(id: string): Promise<void> {
  await waitFor(() => {
    expect(document.activeElement?.querySelector('img')?.getAttribute('src')).toBe(thumbnail(id))
  })
}

// The requests to Immich but the images, by "<method> <path>?<query>", from now on.
function requests(): string[] {
  const calls: string[] = []
  fakeServer.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (!url.pathname.endsWith('/thumbnail')) {
      calls.push(`${request.method} ${url.pathname}${url.search}`)
    }
  })
  return calls
}

beforeEach(async () => {
  vi.resetModules()
  serveConfig(VALID_CONFIG)
  serveLibrary(SAMPLE_LIBRARY)
  await startApp()
  await focusedOn('Todas')
  // The start screen has read what it shows: the backdrop and the line of the library.
  await screen.findByText('16 fotos · de 2023 a 2024')
  await waitFor(() => {
    expect(document.querySelector('.backdrop-photo')).not.toBeNull()
  })
})

afterEach(stopApp)

describe('every photo', () => {
  it('should show the photos of the timeline, the most recent first, under their months', async () => {
    const calls = requests()

    press(KEY.enter)

    await title(MESSAGES.allPhotosTitle)
    await focusedOnPhoto('trip-13')
    await waitFor(() => {
      expect(
        screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
      ).toStrictEqual(['Abril de 2024', 'Março de 2024', 'Dezembro de 2023'])
    })
    // The video of March and the archived photo of December are left out.
    expect(screen.getByText('8 fotos')).toBeTruthy()
    expect(screen.getByText('1 foto')).toBeTruthy()
    expect(sources()[0]).toBe(thumbnail('trip-13'))
    expect(calls).toStrictEqual([
      'GET /api/timeline/buckets?visibility=timeline',
      'GET /api/timeline/bucket?timeBucket=2024-04-01&visibility=timeline',
      'GET /api/timeline/bucket?timeBucket=2024-03-01&visibility=timeline',
      'GET /api/timeline/bucket?timeBucket=2023-12-01&visibility=timeline',
    ])
  })

  it('should present from the photo in focus with Info, and come back to the photo shown last', async () => {
    press(KEY.enter)
    await focusedOnPhoto('trip-13')

    press(KEY.down, KEY.info)

    expect(await screen.findByRole('dialog', { name: '7 de 15' })).toBeTruthy()
    expect(document.querySelector('.viewer')?.classList.contains('is-playing')).toBe(true)
    press(KEY.right, KEY.webOsBack)
    await focusedOnPhoto('trip-06')
    press(KEY.tizenBack)
    await focusedOn('Todas')
  })
})
