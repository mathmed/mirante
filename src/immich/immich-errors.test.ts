import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { API_KEY, fakeServer, IMMICH_URL, serveImmich } from '../../test/fake-immich.ts'
import { libraryErrorOf } from '../../test/library-failure.ts'
import type { PhotoLibrary } from '../core/photo-library.ts'
import { DEFAULT_PRESENTATION } from '../core/presentation-settings.ts'
import { createImmichLibrary } from './immich-library.ts'

// What the console shows of a call the server refuses: the reasons Immich gives, not "Error: 400".
const TIMEOUT_MS = 5000
const ALBUMS_URL = `${IMMICH_URL}/api/albums`

function library(): PhotoLibrary {
  return createImmichLibrary({
    config: { immichUrl: IMMICH_URL, apiKey: API_KEY, presentation: DEFAULT_PRESENTATION },
    timeoutMs: TIMEOUT_MS,
  })
}

async function messageOf(answer: Response): Promise<string> {
  serveImmich()
  fakeServer.use(http.get(ALBUMS_URL, () => answer))
  return (await libraryErrorOf(library().listAlbums())).message
}

describe('detailOf', () => {
  it('should name the status and the message of Immich', async () => {
    const sut = await messageOf(
      HttpResponse.json({ message: 'Service unavailable', statusCode: 503 }, { status: 503 }),
    )

    expect(sut).toBe('HTTP 503: Service unavailable')
  })

  it('should name every field the validation refuses, with its path', async () => {
    const sut = await messageOf(
      HttpResponse.json(
        {
          message: 'Validation failed',
          errors: [
            { code: 'custom', path: ['filter', 'takenAt'], message: 'Invalid date' },
            { code: 'custom', path: 'size', message: 'Too big' },
          ],
        },
        { status: 400 },
      ),
    )

    expect(sut).toBe('HTTP 400: Validation failed (filter.takenAt: Invalid date; Too big)')
  })

  it('should name only the status when the answer gives no reason', async () => {
    const sut = await messageOf(HttpResponse.json({ errors: 'none', message: 42 }, { status: 500 }))

    expect(sut).toBe('HTTP 500')
  })

  it('should name only the status when the answer holds no object', async () => {
    const sut = await messageOf(HttpResponse.json(null, { status: 500 }))

    expect(sut).toBe('HTTP 500')
  })

  it('should keep the error of a call that never got an answer', async () => {
    serveImmich()
    fakeServer.use(http.get(ALBUMS_URL, () => HttpResponse.error()))

    expect((await libraryErrorOf(library().listAlbums())).message).toBe('TypeError: fetch failed')
  })
})
