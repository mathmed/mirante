import { http, HttpResponse, type JsonBodyType, type StrictRequest } from 'msw'
import { setupServer } from 'msw/node'

import {
  albumsOf,
  assetOf,
  assetsAsked,
  bucketOf,
  bucketsOf,
  type FakeLibrary,
  randomOf,
  searchedOf,
  searchRejectionOf,
} from './immich-answers.ts'

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
// the random draws of the presentations, the searches by date of the start screen, the captions and
// the images.
export function serveLibrary(library: FakeLibrary, options: ServeOptions = {}): void {
  serveImmich(options)
  const api = `${options.url ?? IMMICH_URL}/api`
  fakeServer.use(
    http.get(`${api}/albums`, ({ request }) =>
      guarded(request, options, () => HttpResponse.json(albumsOf(library))),
    ),
    http.get(`${api}/timeline/buckets`, ({ request }) =>
      guarded(request, options, () =>
        HttpResponse.json(bucketsOf(assetsAsked(library, new URL(request.url)))),
      ),
    ),
    http.get(`${api}/timeline/bucket`, ({ request }) =>
      guarded(request, options, () => HttpResponse.json(bucketOf(library, new URL(request.url)))),
    ),
    http.post(`${api}/search/random`, async ({ request }) => {
      const size = await sizeOf(request)
      return guarded(request, options, () => HttpResponse.json(randomOf(library, size)))
    }),
    http.post(`${api}/search/metadata`, async ({ request }) => {
      const body: unknown = await request.json()
      return guarded(request, options, () => searchAnswer(library, body))
    }),
    http.get(`${api}/assets/:id/thumbnail`, ({ request }) =>
      guarded(request, options, () => imageOf(request)),
    ),
    http.get(`${api}/assets/:id`, ({ request, params }) =>
      guarded(request, options, () => assetAnswer(library, params['id'])),
    ),
  )
}

function searchAnswer(library: FakeLibrary, body: unknown): Response {
  const rejection = searchRejectionOf(body)
  return rejection === undefined
    ? HttpResponse.json(searchedOf(library, body))
    : HttpResponse.json(rejection, { status: 400 })
}

async function sizeOf(request: Request): Promise<number> {
  const body: unknown = await request.json()
  const size: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'size') : 0
  return typeof size === 'number' ? size : 0
}

function assetAnswer(library: FakeLibrary, id: unknown): Response {
  const asset = typeof id === 'string' ? assetOf(library, id) : undefined
  return asset === undefined
    ? HttpResponse.json({ message: 'Not found' }, { status: 400 })
    : HttpResponse.json(asset)
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

// Only the small sizes a TV needs: the original is never asked for.
function imageOf(request: Request): Response {
  const size = new URL(request.url).searchParams.get('size')
  return size === 'thumbnail' || size === 'preview'
    ? new HttpResponse(IMAGE_BYTES, { headers: { 'Content-Type': 'image/jpeg' } })
    : HttpResponse.json({ message: `Unexpected size ${String(size)}` }, { status: 400 })
}
