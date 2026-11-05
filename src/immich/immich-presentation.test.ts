import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { API_KEY, fakeServer, IMMICH_URL, serveLibrary } from '../../test/fake-immich.ts'
import { failureOf } from '../../test/library-failure.ts'
import { SAMPLE_LIBRARY } from '../../test/sample-library.ts'
import { LibraryFailure, type PhotoLibrary } from '../core/photo-library.ts'
import { DEFAULT_PRESENTATION } from '../core/presentation-settings.ts'
import { createImmichLibrary } from './immich-library.ts'

// The reads of the presentations: random draws of the library and the captions of the photos.
const API = `${IMMICH_URL}/api`
const TIMEOUT_MS = 5000

function library(): PhotoLibrary {
  return createImmichLibrary({
    config: { immichUrl: IMMICH_URL, apiKey: API_KEY, presentation: DEFAULT_PRESENTATION },
    timeoutMs: TIMEOUT_MS,
  })
}

function randomAnswer(): readonly Record<string, unknown>[] {
  return [
    {
      id: 'trip-00',
      type: 'IMAGE',
      fileCreatedAt: '2024-03-20T12:00:00.000Z',
      localDateTime: '2024-03-20T12:00:00.000Z',
    },
  ]
}

describe('listRandomPhotos', () => {
  it('should draw photos of the timeline, as many as asked for, on the date of their place', async () => {
    const bodies: unknown[] = []
    serveLibrary(SAMPLE_LIBRARY)
    fakeServer.events.on('request:start', ({ request }) => {
      if (request.url.endsWith('/search/random')) {
        void request
          .clone()
          .json()
          .then((body: unknown) => bodies.push(body))
      }
    })

    const photos = await library().listRandomPhotos(2)

    expect(photos).toStrictEqual([
      {
        id: 'trip-00',
        takenAtMs: Date.parse('2024-03-20T12:00:00.000Z'),
        date: { year: 2024, month: 3, day: 20 },
      },
      {
        id: 'trip-01',
        takenAtMs: Date.parse('2024-03-20T12:01:00.000Z'),
        date: { year: 2024, month: 3, day: 20 },
      },
    ])
    expect(bodies).toStrictEqual([
      { size: 2, type: 'IMAGE', visibility: 'timeline', withExif: false },
    ])
    fakeServer.events.removeAllListeners()
  })

  it('should read the date of the place a photo was taken from its local time', async () => {
    serveLibrary({
      albums: [],
      assets: SAMPLE_LIBRARY.assets.filter(({ id }) => id === 'family-dinner'),
    })

    expect(await library().listRandomPhotos(200)).toStrictEqual([
      {
        id: 'family-dinner',
        takenAtMs: Date.parse('2023-12-25T01:30:00.000Z'),
        date: { year: 2023, month: 12, day: 24 },
      },
    ])
  })

  it('should leave out what is not a photo', async () => {
    const [photo] = randomAnswer()
    fakeServer.use(
      http.post(`${API}/search/random`, () =>
        HttpResponse.json([photo, { ...photo, id: 'clip', type: 'VIDEO' }]),
      ),
    )

    expect((await library().listRandomPhotos(2)).map(({ id }) => id)).toStrictEqual(['trip-00'])
  })

  it.each([
    { missing: 'a list', answer: { assets: [] } },
    { missing: 'an id', answer: [{ ...randomAnswer()[0], id: 7 }] },
    { missing: 'a date', answer: [{ ...randomAnswer()[0], fileCreatedAt: 'soon' }] },
    { missing: 'a local date', answer: [{ ...randomAnswer()[0], localDateTime: null }] },
  ])('should fail as not Immich without $missing', async ({ answer }) => {
    fakeServer.use(http.post(`${API}/search/random`, () => HttpResponse.json(answer)))

    expect(await failureOf(library().listRandomPhotos(1))).toBe(LibraryFailure.NotImmich)
  })
})

describe('readCaption', () => {
  it('should read the description of the photo, without the blanks around it', async () => {
    serveLibrary(SAMPLE_LIBRARY)

    expect(await library().readCaption('trip-00')).toBe('Pôr do sol na Torre de Belém')
    expect(await library().readCaption('family-dinner')).toBe('Ceia de Natal na casa da vó')
  })

  it('should read no caption for a photo without a description', async () => {
    serveLibrary(SAMPLE_LIBRARY)

    expect(await library().readCaption('trip-01')).toBeUndefined()
  })

  it.each([{ exifInfo: { description: null } }, { exifInfo: { description: '   ' } }, {}])(
    'should read no caption from %j',
    async (answer) => {
      fakeServer.use(http.get(`${API}/assets/p`, () => HttpResponse.json({ id: 'p', ...answer })))

      expect(await library().readCaption('p')).toBeUndefined()
    },
  )

  it('should fail as not Immich on a description that is not text', async () => {
    fakeServer.use(
      http.get(`${API}/assets/p`, () =>
        HttpResponse.json({ id: 'p', exifInfo: { description: 3 } }),
      ),
    )

    expect(await failureOf(library().readCaption('p'))).toBe(LibraryFailure.NotImmich)
  })

  it('should keep an id inside its part of the address', async () => {
    const paths: string[] = []
    fakeServer.use(
      http.get(`${API}/assets/:id`, ({ request }) => {
        paths.push(new URL(request.url).pathname)
        return HttpResponse.json({ id: 'x' })
      }),
    )

    await library().readCaption('../users/me')

    expect(paths).toStrictEqual(['/api/assets/..%2Fusers%2Fme'])
  })
})
