import {
  type AlbumResponseDto,
  AssetOrder,
  AssetVisibility,
  type TimeBucketAssetResponseDto,
  type TimeBucketsResponseDto,
} from '@immich/sdk'
import { http, HttpResponse, type JsonBodyType, type StrictRequest } from 'msw'
import { setupServer } from 'msw/node'

// A fake Immich server (MSW): no test reaches a real server or uses a real API key. Requests nobody
// answers fail the test (`onUnhandledFrame: 'error'` in test/setup.ts). Its answers have the shapes
// of the SDK's types, which Immich 3.3.6 generates from its own API.
export const IMMICH_URL = 'http://immich.test'
export const API_KEY = 'test-read-only-key'
const IMMICH_VERSION = { major: 3, minor: 3, patch: 6, prerelease: null }

// jsdom serves the page from here: the app finds config.json next to it.
export const PAGE_ORIGIN = 'http://localhost:3000'
const PAGE_URL = `${PAGE_ORIGIN}/`
export const CONFIG_URL = `${PAGE_URL}config.json`

// A JPEG's first bytes: enough for the tests, which only check what was asked for.
export const IMAGE_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])

export const fakeServer = setupServer()

export const VALID_CONFIG = { immichUrl: IMMICH_URL, apiKey: API_KEY }

export interface FakeAsset {
  readonly id: string
  // When it was taken, in UTC, and the offset of the place where it was taken.
  readonly takenAt: string
  readonly offsetHours: number
  readonly isImage: boolean
  readonly albumIds: readonly string[]
  // Archived assets are in their albums, never in the timeline.
  readonly isArchived?: boolean
}

interface FakeAlbum {
  readonly id: string
  readonly name: string
  readonly isOldestFirst?: boolean
}

export interface FakeLibrary {
  readonly albums: readonly FakeAlbum[]
  readonly assets: readonly FakeAsset[]
}

interface ServeOptions {
  // Where the server is: Immich itself, or the proxy in front of it at the address of the page.
  readonly url?: string
  // A proxy that adds the key to every request answers requests without one.
  readonly isKeyAdded?: boolean
}

export function serveConfig(body: JsonBodyType): void {
  fakeServer.use(http.get(CONFIG_URL, () => HttpResponse.json(body)))
}

export function serveConfigStatus(status: number, body = ''): void {
  fakeServer.use(http.get(CONFIG_URL, () => new HttpResponse(body, { status })))
}

// The two calls the app makes to say which server it reached: the public version and the key check.
export function serveImmich(options: ServeOptions = {}): void {
  const api = `${options.url ?? IMMICH_URL}/api`
  fakeServer.use(
    http.get(`${api}/server/version`, () => HttpResponse.json(IMMICH_VERSION)),
    http.post(`${api}/auth/validateToken`, ({ request }) =>
      guarded(request, options, () => HttpResponse.json({ authStatus: true })),
    ),
  )
}

// The reads of the gallery: the albums, the months of the timeline and of an album, their assets,
// and the images.
export function serveLibrary(library: FakeLibrary, options: ServeOptions = {}): void {
  serveImmich(options)
  const api = `${options.url ?? IMMICH_URL}/api`
  fakeServer.use(
    http.get(`${api}/albums`, ({ request }) =>
      guarded(request, options, () => HttpResponse.json(albumsOf(library))),
    ),
    http.get(`${api}/timeline/buckets`, ({ request }) =>
      guarded(request, options, () => HttpResponse.json(bucketsOf(assetsAsked(library, request)))),
    ),
    http.get(`${api}/timeline/bucket`, ({ request }) =>
      guarded(request, options, () => HttpResponse.json(bucketOf(library, request))),
    ),
    http.get(`${api}/assets/:id/thumbnail`, ({ request }) =>
      guarded(request, options, () => imageOf(request)),
    ),
  )
}

function guarded(
  request: StrictRequest<JsonBodyType>,
  options: ServeOptions,
  answer: () => Response,
): Response {
  const key = request.headers.get('x-api-key')
  const isAllowed = key === API_KEY || (options.isKeyAdded === true && key === null)
  return isAllowed
    ? answer()
    : HttpResponse.json(
        { message: 'Invalid API key', error: 'Unauthorized', statusCode: 401 },
        { status: 401 },
      )
}

function albumsOf(library: FakeLibrary): AlbumResponseDto[] {
  return library.albums.map((album) => {
    const assets = library.assets.filter((asset) => asset.albumIds.includes(album.id))
    const dates = assets
      .map((asset) => asset.takenAt)
      .sort((first, second) => first.localeCompare(second))
    return {
      id: album.id,
      albumName: album.name,
      albumThumbnailAssetId: assets[0]?.id ?? null,
      albumUsers: [],
      assetCount: assets.length,
      createdAt: '2020-01-01T00:00:00.000Z',
      description: '',
      hasSharedLink: false,
      isActivityEnabled: true,
      shared: false,
      updatedAt: '2020-01-01T00:00:00.000Z',
      order: album.isOldestFirst === true ? AssetOrder.Asc : AssetOrder.Desc,
      ...(dates.length === 0 ? {} : { startDate: dates[0], endDate: dates[dates.length - 1] }),
    }
  })
}

// An album's assets when the request names one, else the timeline: everything not archived.
function assetsAsked(library: FakeLibrary, request: Request): readonly FakeAsset[] {
  const albumId = new URL(request.url).searchParams.get('albumId')
  return albumId === null
    ? library.assets.filter((asset) => asset.isArchived !== true)
    : library.assets.filter((asset) => asset.albumIds.includes(albumId))
}

// Immich names each month by its first day, newest first.
function bucketsOf(assets: readonly FakeAsset[]): TimeBucketsResponseDto[] {
  const counts = new Map<string, number>()
  for (const asset of assets) {
    const month = monthOf(asset)
    counts.set(month, (counts.get(month) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([first], [second]) => second.localeCompare(first))
    .map(([timeBucket, count]) => ({ timeBucket, count }))
}

function bucketOf(library: FakeLibrary, request: Request): TimeBucketAssetResponseDto {
  const month = new URL(request.url).searchParams.get('timeBucket')
  const assets = assetsAsked(library, request).filter((asset) => monthOf(asset) === month)
  return {
    id: assets.map((asset) => asset.id),
    isImage: assets.map((asset) => asset.isImage),
    fileCreatedAt: assets.map((asset) => asset.takenAt),
    localOffsetHours: assets.map((asset) => asset.offsetHours),
    createdAt: assets.map((asset) => asset.takenAt),
    duration: assets.map((asset) => (asset.isImage ? null : 12)),
    isFavorite: assets.map(() => false),
    isTrashed: assets.map(() => false),
    livePhotoVideoId: assets.map(() => null),
    ownerId: assets.map(() => 'owner'),
    projectionType: assets.map(() => null),
    ratio: assets.map(() => 1.5),
    thumbhash: assets.map(() => null),
    visibility: assets.map(() => AssetVisibility.Timeline),
  }
}

function monthOf(asset: FakeAsset): string {
  return `${asset.takenAt.slice(0, 7)}-01`
}

// Only the small sizes a TV needs: the original is never asked for.
function imageOf(request: Request): Response {
  const size = new URL(request.url).searchParams.get('size')
  return size === 'thumbnail' || size === 'preview'
    ? new HttpResponse(IMAGE_BYTES, { headers: { 'Content-Type': 'image/jpeg' } })
    : HttpResponse.json({ message: `Unexpected size ${String(size)}` }, { status: 400 })
}
