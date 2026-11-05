import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import {
  API_KEY,
  fakeServer,
  IMAGE_BYTES,
  IMMICH_URL,
  PAGE_ORIGIN,
  serveImmich,
  serveLibrary,
} from '../../test/fake-immich.ts'
import { failureOf } from '../../test/library-failure.ts'
import { EMPTY, FAMILY, SAMPLE_LIBRARY, TRIP, TRIP_PHOTOS } from '../../test/sample-library.ts'
import {
  type Album,
  ImageSize,
  LibraryFailure,
  type PhotoLibrary,
  PhotoOrder,
} from '../core/photo-library.ts'
import { DEFAULT_PRESENTATION } from '../core/presentation-settings.ts'
import type { RuntimeConfig } from '../core/runtime-config.ts'
import { createImmichLibrary } from './immich-library.ts'

// Generous, so that a slow machine never turns an answer into a timeout; the timeout test uses its own.
const TIMEOUT_MS = 5000
const SHORT_TIMEOUT_MS = 50
const API = `${IMMICH_URL}/api`
const VERSION_URL = `${API}/server/version`
const JSON_CONTENT = { 'Content-Type': 'application/json' }
const CONFIG: RuntimeConfig = {
  immichUrl: IMMICH_URL,
  apiKey: API_KEY,
  presentation: DEFAULT_PRESENTATION,
}

function library(config: Partial<RuntimeConfig> = {}, timeoutMs = TIMEOUT_MS): PhotoLibrary {
  return createImmichLibrary({ config: { ...CONFIG, ...config }, timeoutMs })
}

function withoutKey(immichUrl = IMMICH_URL): PhotoLibrary {
  return createImmichLibrary({
    config: { immichUrl, presentation: DEFAULT_PRESENTATION },
    timeoutMs: TIMEOUT_MS,
  })
}

async function albumNamed(sut: PhotoLibrary, id: string): Promise<Album> {
  const album = (await sut.listAlbums()).find((candidate) => candidate.id === id)
  if (album === undefined) {
    throw new Error(`no album ${id}`)
  }
  return album
}

describe('describeServer', () => {
  it('should describe the server with its address and version', async () => {
    serveImmich()

    expect(await library().describeServer()).toStrictEqual({
      address: 'immich.test',
      version: '3.3.6',
    })
  })

  it('should send the API key of the configuration', async () => {
    serveImmich()

    expect(await failureOf(library({ apiKey: 'another-key' }).describeServer())).toBe(
      LibraryFailure.KeyRejected,
    )
  })

  it('should send no key when the configuration has none, for the proxy to add it', async () => {
    serveImmich({ url: PAGE_ORIGIN, isKeyAdded: true })

    expect(await withoutKey(PAGE_ORIGIN).describeServer()).toStrictEqual({
      address: 'localhost:3000',
      version: '3.3.6',
    })
  })

  it('should fail as a missing key when no key reaches the server', async () => {
    serveImmich()

    expect(await failureOf(withoutKey().describeServer())).toBe(LibraryFailure.KeyMissing)
  })

  it('should fail as unreachable when the server does not answer in time', async () => {
    fakeServer.use(http.get(VERSION_URL, async () => delay('infinite')))

    expect(await failureOf(library({}, SHORT_TIMEOUT_MS).describeServer())).toBe(
      LibraryFailure.Unreachable,
    )
  })

  it('should fail as unreachable when the network fails', async () => {
    fakeServer.use(http.get(VERSION_URL, () => HttpResponse.error()))

    expect(await failureOf(library().describeServer())).toBe(LibraryFailure.Unreachable)
  })

  it('should fail as not Immich when the address answers with a page', async () => {
    fakeServer.use(http.get(VERSION_URL, () => HttpResponse.html('<html></html>')))

    expect(await failureOf(library().describeServer())).toBe(LibraryFailure.NotImmich)
  })

  it('should fail as not Immich when the address has no Immich API', async () => {
    fakeServer.use(http.get(VERSION_URL, () => HttpResponse.json({}, { status: 404 })))

    expect(await failureOf(library().describeServer())).toBe(LibraryFailure.NotImmich)
  })

  it('should fail as not Immich when the version is not one', async () => {
    serveImmich()
    fakeServer.use(http.get(VERSION_URL, () => HttpResponse.json({ major: '3', minor: 1 })))

    expect(await failureOf(library().describeServer())).toBe(LibraryFailure.NotImmich)
  })

  it('should fail as a server error on any other status', async () => {
    fakeServer.use(http.get(VERSION_URL, () => HttpResponse.json({}, { status: 503 })))

    expect(await failureOf(library().describeServer())).toBe(LibraryFailure.ServerError)
  })

  it('should let an error it does not know through untouched', async () => {
    fakeServer.use(http.get(VERSION_URL, () => new HttpResponse('{', { headers: JSON_CONTENT })))

    await expect(library().describeServer()).rejects.toBeInstanceOf(SyntaxError)
  })
})

describe('listAlbums', () => {
  it('should list the albums with their cover, count, order and last photo', async () => {
    serveLibrary(SAMPLE_LIBRARY)

    expect(await library().listAlbums()).toStrictEqual([
      {
        id: TRIP.id,
        name: TRIP.name,
        photoCount: TRIP_PHOTOS + 1,
        order: PhotoOrder.OldestFirst,
        coverPhotoId: 'trip-00',
        lastPhotoAtMs: Date.parse('2024-04-02T09:13:00.000Z'),
      },
      {
        id: FAMILY.id,
        name: FAMILY.name,
        photoCount: 2,
        order: PhotoOrder.NewestFirst,
        coverPhotoId: 'family-dinner',
        lastPhotoAtMs: Date.parse('2023-12-26T15:00:00.000Z'),
      },
      { id: EMPTY.id, name: EMPTY.name, photoCount: 0, order: PhotoOrder.NewestFirst },
    ])
  })

  it('should fail as a rejected key when the key may not read albums', async () => {
    fakeServer.use(http.get(`${API}/albums`, () => HttpResponse.json({}, { status: 403 })))

    expect(await failureOf(library().listAlbums())).toBe(LibraryFailure.KeyRejected)
  })

  it.each([
    { missing: 'a list', answer: { albums: [] } },
    { missing: 'an album with a name', answer: [{ id: 'a', assetCount: 1 }] },
    { missing: 'an album with an id', answer: [{ albumName: 'A', assetCount: 1 }] },
    { missing: 'an album with a count', answer: [{ id: 'a', albumName: 'A' }] },
    { missing: 'a date', answer: [{ id: 'a', albumName: 'A', assetCount: 1, endDate: 'soon' }] },
  ])('should fail as not Immich without $missing', async ({ answer }) => {
    fakeServer.use(http.get(`${API}/albums`, () => HttpResponse.json(answer)))

    expect(await failureOf(library().listAlbums())).toBe(LibraryFailure.NotImmich)
  })
})

describe('listAlbumPhotos', () => {
  it('should list the photos of every month of the album, without its videos', async () => {
    serveLibrary(SAMPLE_LIBRARY)
    const sut = library()

    const photos = await sut.listAlbumPhotos(await albumNamed(sut, TRIP.id))

    expect(photos).toHaveLength(TRIP_PHOTOS)
    expect(photos.map((photo) => photo.id)).not.toContain('trip-video')
    expect(photos.find((photo) => photo.id === 'trip-00')).toStrictEqual({
      id: 'trip-00',
      takenAtMs: Date.parse('2024-03-20T12:00:00.000Z'),
      date: { year: 2024, month: 3, day: 20 },
    })
  })

  it('should list an archived photo in its album', async () => {
    serveLibrary(SAMPLE_LIBRARY)
    const sut = library()

    const photos = await sut.listAlbumPhotos(await albumNamed(sut, FAMILY.id))

    expect(photos.map((photo) => photo.id)).toStrictEqual(['family-dinner', 'family-archived'])
  })

  it('should list no photo for an empty album', async () => {
    serveLibrary(SAMPLE_LIBRARY)
    const sut = library()

    expect(await sut.listAlbumPhotos(await albumNamed(sut, EMPTY.id))).toStrictEqual([])
  })
})

describe('listTimelineMonths', () => {
  it('should list the months of the timeline, without the archived photos', async () => {
    serveLibrary(SAMPLE_LIBRARY)

    expect(await library().listTimelineMonths()).toStrictEqual([
      { key: '2024-04-01', year: 2024, month: 4 },
      { key: '2024-03-01', year: 2024, month: 3 },
      { key: '2023-12-01', year: 2023, month: 12 },
    ])
  })

  it('should read a month named by a full timestamp', async () => {
    const timeBucket = '2024-01-01T00:00:00.000Z'
    fakeServer.use(
      http.get(`${API}/timeline/buckets`, () => HttpResponse.json([{ timeBucket, count: 3 }])),
    )

    expect(await library().listTimelineMonths()).toStrictEqual([
      { key: timeBucket, year: 2024, month: 1 },
    ])
  })

  it.each([
    [{ count: 1 }],
    [{ timeBucket: 'last year', count: 1 }],
    [{ timeBucket: '2024-13-01' }],
    [{ timeBucket: '2024-00-01' }],
  ])('should fail as not Immich on the month %j', async (bucket) => {
    fakeServer.use(http.get(`${API}/timeline/buckets`, () => HttpResponse.json([bucket])))

    expect(await failureOf(library().listTimelineMonths())).toBe(LibraryFailure.NotImmich)
  })
})

describe('listMonthPhotos', () => {
  it('should list the photos of the month on the date of the place they were taken', async () => {
    serveLibrary(SAMPLE_LIBRARY)

    const photos = await library().listMonthPhotos({ key: '2023-12-01', year: 2023, month: 12 })

    expect(photos).toStrictEqual([
      {
        id: 'family-dinner',
        takenAtMs: Date.parse('2023-12-25T01:30:00.000Z'),
        date: { year: 2023, month: 12, day: 24 },
      },
    ])
  })

  const VALID = {
    id: ['a'],
    isImage: [true],
    fileCreatedAt: ['2024-01-01T00:00:00Z'],
    localOffsetHours: [0],
  }

  it.each([
    { missing: 'the ids', bucket: { ...VALID, id: 'a' } },
    { missing: 'the kinds', bucket: { ...VALID, isImage: null } },
    { missing: 'the dates', bucket: { ...VALID, fileCreatedAt: {} } },
    { missing: 'the offsets', bucket: { ...VALID, localOffsetHours: undefined } },
    { missing: 'an id', bucket: { ...VALID, id: [7] } },
    { missing: 'an offset', bucket: { ...VALID, localOffsetHours: [] } },
    { missing: 'a date', bucket: { ...VALID, fileCreatedAt: ['soon'] } },
    { missing: 'a date as text', bucket: { ...VALID, fileCreatedAt: [1_700_000_000] } },
  ])('should fail as not Immich without $missing', async ({ bucket }) => {
    fakeServer.use(http.get(`${API}/timeline/bucket`, () => HttpResponse.json(bucket)))

    expect(
      await failureOf(library().listMonthPhotos({ key: '2024-01-01', year: 2024, month: 1 })),
    ).toBe(LibraryFailure.NotImmich)
  })
})

describe('imageUrl', () => {
  it.each([
    [ImageSize.Thumbnail, 'thumbnail'],
    [ImageSize.Preview, 'preview'],
  ])('should give the address of the %s, without the key', (size, mediaSize) => {
    expect(library().imageUrl('trip-00', size)).toBe(
      `${API}/assets/trip-00/thumbnail?size=${mediaSize}`,
    )
  })

  it('should load the image from the server', async () => {
    serveLibrary(SAMPLE_LIBRARY)

    const response = await fetch(library().imageUrl('trip-00', ImageSize.Preview), {
      headers: { 'x-api-key': API_KEY },
    })

    expect(new Uint8Array(await response.arrayBuffer())).toStrictEqual(IMAGE_BYTES)
  })

  it('should keep an id inside its part of the address', () => {
    expect(library().imageUrl('../users/me', ImageSize.Thumbnail)).toBe(
      `${API}/assets/..%2Fusers%2Fme/thumbnail?size=thumbnail`,
    )
  })
})
