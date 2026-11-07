import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { dateOf } from '../../test/dated-photos.ts'
import { API_KEY, fakeServer, IMMICH_URL, serveLibrary } from '../../test/fake-immich.ts'
import type { FakeLibrary } from '../../test/immich-answers.ts'
import { failureOf } from '../../test/library-failure.ts'
import { SAMPLE_LIBRARY } from '../../test/sample-library.ts'
import {
  type DateSearch,
  LibraryFailure,
  type PhotoLibrary,
  PhotoOrder,
} from '../core/photo-library.ts'
import { DEFAULT_PRESENTATION } from '../core/presentation-settings.ts'
import { createImmichLibrary } from './immich-library.ts'

// The search by date of the start screen, for the photos of this day in past years.
const API = `${IMMICH_URL}/api`
const TIMEOUT_MS = 5000

function library(): PhotoLibrary {
  return createImmichLibrary({
    config: { immichUrl: IMMICH_URL, apiKey: API_KEY, presentation: DEFAULT_PRESENTATION },
    timeoutMs: TIMEOUT_MS,
  })
}

// New Year's Eve in Brazil, and six photos past midnight, in the early morning after it: all within
// the instants a search of December 31st covers.
const MORNING_AFTER: FakeLibrary = {
  albums: [],
  assets: [
    ...['2025-12-31T20:00:00.000Z', '2025-12-31T22:00:00.000Z'].map((takenAt, index) => ({
      id: `eve-${String(index + 1)}`,
      takenAt,
      offsetHours: -3,
      isImage: true,
      albumIds: [],
    })),
    ...[1, 2, 3, 4, 5, 6].map((hour) => ({
      id: `new-year-${String(hour)}`,
      takenAt: `2026-01-01T0${String(hour + 3)}:00:00.000Z`,
      offsetHours: -3,
      isImage: true,
      albumIds: [],
    })),
  ],
}

function search(from: string, to: string, order: PhotoOrder = PhotoOrder.OldestFirst): DateSearch {
  return { from: dateOf(from), to: dateOf(to), order, count: 3 }
}

function bodies(): unknown[] {
  const sent: unknown[] = []
  fakeServer.events.on('request:start', ({ request }) => {
    if (request.url.endsWith('/search/metadata')) {
      void request
        .clone()
        .json()
        .then((body: unknown) => sent.push(body))
    }
  })
  return sent
}

describe('listPhotosTaken', () => {
  it('should search the photos of the timeline that may fall on those days anywhere', async () => {
    serveLibrary(SAMPLE_LIBRARY)
    const sent = bodies()

    await library().listPhotosTaken(search('2024-03-20', '2024-03-21', PhotoOrder.NewestFirst))

    expect(sent).toStrictEqual([
      {
        takenAfter: '2024-03-19T10:00:00.000Z',
        takenBefore: '2024-03-22T12:00:00.000Z',
        type: 'IMAGE',
        visibility: 'timeline',
        withExif: false,
        size: 3,
        orderBy: { field: 'localDateTime', direction: 'desc' },
        page: 1,
      },
    ])
    fakeServer.events.removeAllListeners()
  })

  it('should give the photos found, as many as asked for, the oldest first', async () => {
    serveLibrary(SAMPLE_LIBRARY)

    const sut = await library().listPhotosTaken(search('2024-03-20', '2024-03-21'))

    expect(sut.map((photo) => photo.id)).toStrictEqual(['trip-00', 'trip-01', 'trip-02'])
    expect(sut[0]).toStrictEqual({
      id: 'trip-00',
      takenAtMs: Date.parse('2024-03-20T12:00:00.000Z'),
      date: { year: 2024, month: 3, day: 20 },
      aspectRatio: 1.5,
    })
  })

  it('should give the newest first when asked, without the videos', async () => {
    serveLibrary(SAMPLE_LIBRARY)

    const sut = await library().listPhotosTaken(
      search('2024-03-20', '2024-03-21', PhotoOrder.NewestFirst),
    )

    expect(sut.map((photo) => photo.id)).toStrictEqual(['trip-07', 'trip-06', 'trip-05'])
  })

  it('should keep only the photos of the days searched, by the date of their place', async () => {
    serveLibrary(SAMPLE_LIBRARY)

    const christmasEve = await library().listPhotosTaken(search('2023-12-24', '2023-12-24'))
    const christmas = await library().listPhotosTaken(search('2023-12-25', '2023-12-25'))

    expect(christmasEve.map((photo) => photo.id)).toStrictEqual(['family-dinner'])
    expect(christmas).toStrictEqual([])
  })

  it('should read the next page when a full one holds none of the days searched', async () => {
    serveLibrary(MORNING_AFTER)
    const sent = bodies()

    const sut = await library().listPhotosTaken(
      search('2025-12-31', '2025-12-31', PhotoOrder.NewestFirst),
    )

    expect(sut.map((photo) => photo.id)).toStrictEqual(['eve-2', 'eve-1'])
    expect(sent).toMatchObject([{ page: 1 }, { page: 2 }, { page: 3 }])
    fakeServer.events.removeAllListeners()
  })

  it('should read no further page once one holds a photo of the days searched', async () => {
    serveLibrary(MORNING_AFTER)
    const sent = bodies()

    const sut = await library().listPhotosTaken(
      search('2025-12-31', '2026-01-01', PhotoOrder.NewestFirst),
    )

    expect(sut.map((photo) => photo.id)).toStrictEqual(['new-year-6', 'new-year-5', 'new-year-4'])
    expect(sent).toHaveLength(1)
    fakeServer.events.removeAllListeners()
  })

  it('should read five pages at most', async () => {
    serveLibrary(MORNING_AFTER)
    const sent = bodies()

    const sut = await library().listPhotosTaken({
      ...search('2025-12-31', '2025-12-31', PhotoOrder.NewestFirst),
      count: 1,
    })

    expect(sut).toStrictEqual([])
    expect(sent).toHaveLength(5)
    fakeServer.events.removeAllListeners()
  })

  it('should fail as not Immich when the answer is not a search', async () => {
    serveLibrary(SAMPLE_LIBRARY)
    fakeServer.use(http.post(`${API}/search/metadata`, () => HttpResponse.json({ albums: {} })))

    expect(await failureOf(library().listPhotosTaken(search('2024-03-20', '2024-03-20')))).toBe(
      LibraryFailure.NotImmich,
    )
  })

  it('should fail as not Immich when the answer has no assets', async () => {
    serveLibrary(SAMPLE_LIBRARY)
    fakeServer.use(http.post(`${API}/search/metadata`, () => HttpResponse.json({ assets: null })))

    expect(await failureOf(library().listPhotosTaken(search('2024-03-20', '2024-03-20')))).toBe(
      LibraryFailure.NotImmich,
    )
  })
})
