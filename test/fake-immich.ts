import { http, HttpResponse, type JsonBodyType } from 'msw'
import { setupServer } from 'msw/node'

// A fake Immich server (MSW): no test reaches a real server or uses a real API key. Requests nobody
// answers fail the test (`onUnhandledFrame: 'error'` in test/setup.ts).
export const IMMICH_URL = 'http://immich.test'
export const API_KEY = 'test-read-only-key'
const IMMICH_VERSION = { major: 3, minor: 3, patch: 6, prerelease: null }

// jsdom serves the page from here: the app finds config.json next to it.
const PAGE_URL = 'http://localhost:3000/'
export const CONFIG_URL = `${PAGE_URL}config.json`

export const fakeServer = setupServer()

export const VALID_CONFIG = { immichUrl: IMMICH_URL, apiKey: API_KEY }

export function serveConfig(body: JsonBodyType): void {
  fakeServer.use(http.get(CONFIG_URL, () => HttpResponse.json(body)))
}

export function serveConfigStatus(status: number, body = ''): void {
  fakeServer.use(http.get(CONFIG_URL, () => new HttpResponse(body, { status })))
}

// The two calls the app makes to say which server it reached: the public version and the key check.
export function serveImmich(): void {
  fakeServer.use(
    http.get(`${IMMICH_URL}/api/server/version`, () => HttpResponse.json(IMMICH_VERSION)),
    http.post(`${IMMICH_URL}/api/auth/validateToken`, ({ request }) =>
      request.headers.get('x-api-key') === API_KEY
        ? HttpResponse.json({ authStatus: true })
        : HttpResponse.json(
            { message: 'Invalid API key', error: 'Unauthorized', statusCode: 401 },
            { status: 401 },
          ),
    ),
  )
}
