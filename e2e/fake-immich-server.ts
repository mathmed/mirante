// A fake Immich behind the owner's proxy, on a real port, for the app that a browser runs from
// file://: it answers CORS the way that proxy does (any origin, a 204 to the preflight, GET, HEAD,
// POST and OPTIONS, and the Content-Type header of the random draw), adds the key itself (it never
// asks for one) and records every request. It serves a library (by default, one album of two
// photos, in one month), its random draws, its searches by date and captions, and the images an option draws (by
// default, a small gray square).
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

import { encodePng } from '../scripts/packaging/png.ts'
import {
  albumsOf,
  assetOf,
  assetsAsked,
  bucketOf,
  bucketsOf,
  type FakeLibrary,
  randomOf,
  searchedOf,
} from '../test/immich-answers.ts'

export const ALBUM_NAME = 'Viagem a Lisboa'
export const CAPTION = 'Bom dia, Lisboa'
export const PHOTO_IDS = ['photo-1', 'photo-2'] as const
const ALLOWED_METHODS = 'GET, HEAD, POST, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type'
// What the app draws for each round of the whole library.
const DRAW_SIZE = 200
const VERSION = { major: 3, minor: 3, patch: 6, prerelease: null }
// A small opaque image the browser decodes, so that a loaded <img> has a width.
const IMAGE = encodePng({ width: 4, height: 4, pixels: new Uint8Array(64).fill(200) })

const TRIP_LIBRARY: FakeLibrary = {
  albums: [{ id: 'album-trip', name: ALBUM_NAME, isOldestFirst: true }],
  assets: [
    {
      id: PHOTO_IDS[0],
      takenAt: '2024-03-09T10:00:00.000Z',
      offsetHours: 0,
      isImage: true,
      albumIds: ['album-trip'],
      description: CAPTION,
    },
    {
      id: PHOTO_IDS[1],
      takenAt: '2024-03-10T12:00:00.000Z',
      offsetHours: 0,
      isImage: true,
      albumIds: ['album-trip'],
    },
  ],
}

// What a request asks for: its address, and the JSON body it sends, if any.
interface Asked {
  readonly location: URL
  readonly body: unknown
}

type JsonAnswer = (library: FakeLibrary, asked: Asked) => unknown

const JSON_ANSWERS: ReadonlyMap<string, JsonAnswer> = new Map<string, JsonAnswer>([
  ['GET /api/server/version', () => VERSION],
  ['POST /api/auth/validateToken', () => ({ authStatus: true })],
  ['GET /api/albums', (library) => albumsOf(library)],
  [
    'GET /api/timeline/buckets',
    (library, { location }) => bucketsOf(assetsAsked(library, location)),
  ],
  ['GET /api/timeline/bucket', (library, { location }) => bucketOf(library, location)],
  ['POST /api/search/random', (library) => randomOf(library, DRAW_SIZE)],
  ['POST /api/search/metadata', (library, { body }) => searchedOf(library, body)],
])

const ASSET = /^\/api\/assets\/([^/]+)$/

const THUMBNAIL = /^\/api\/assets\/([^/]+)\/thumbnail$/
const IMAGE_SIZES: ReadonlySet<string> = new Set(['thumbnail', 'preview'])

interface RecordedRequest {
  readonly method: string
  readonly url: string
  readonly origin: string | undefined
  readonly apiKey: string | undefined
}

export interface FakeImmichOptions {
  readonly library: FakeLibrary
  // The PNG of a photo, in the size asked for.
  readonly image: (photoId: string, size: string) => Uint8Array
}

export interface FakeImmich {
  readonly url: string
  readonly requests: RecordedRequest[]
  // Whether it answers CORS; without it, a browser blocks every call from file://.
  isCorsAllowed: boolean
  // How long it waits before answering a call, by "<method> <path>": a slow server.
  readonly delaysMs: Map<string, number>
  readonly close: () => Promise<void>
}

export async function startFakeImmich(
  options: FakeImmichOptions = { library: TRIP_LIBRARY, image: () => IMAGE },
): Promise<FakeImmich> {
  const requests: RecordedRequest[] = []
  const delaysMs = new Map<string, number>()
  const settings = { isCorsAllowed: true }
  const server = createServer((request, response) => {
    const call = recorded(request)
    requests.push(call)
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8')
      setTimeout(
        () => {
          answer({ request, response, options, isCorsAllowed: settings.isCorsAllowed, body })
        },
        delaysMs.get(callOf(call)) ?? 0,
      )
    })
  })
  const url = `http://127.0.0.1:${String(await listen(server))}`
  return Object.assign(settings, { url, requests, delaysMs, close: async () => closed(server) })
}

async function closed(server: Server): Promise<void> {
  server.closeAllConnections()
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve()
    })
  })
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  return (server.address() as AddressInfo).port
}

// "<method> <path>", without the query.
function callOf({ method, url }: RecordedRequest): string {
  return `${method} ${new URL(url, 'http://immich.test').pathname}`
}

function recorded(request: IncomingMessage): RecordedRequest {
  const apiKey = request.headers['x-api-key']
  return {
    method: request.method ?? '',
    url: request.url ?? '/',
    origin: request.headers.origin,
    apiKey: typeof apiKey === 'string' ? apiKey : undefined,
  }
}

interface Exchange {
  readonly request: IncomingMessage
  readonly response: ServerResponse
  readonly options: FakeImmichOptions
  readonly isCorsAllowed: boolean
  // The body of the request, as sent: empty for most.
  readonly body: string
}

function answer({ request, response, options, isCorsAllowed, body: sent }: Exchange): void {
  if (isCorsAllowed) {
    response.setHeader('Access-Control-Allow-Origin', '*')
  }
  if (request.method === 'OPTIONS') {
    response
      .writeHead(204, {
        'Access-Control-Allow-Methods': ALLOWED_METHODS,
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      })
      .end()
    return
  }
  const call = recorded(request)
  const location = new URL(call.url, 'http://immich.test')
  const body = jsonAnswer(
    call,
    { location, body: sent === '' ? undefined : JSON.parse(sent) },
    options.library,
  )
  if (body !== undefined) {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
    return
  }
  answerImage(location, response, options)
}

function jsonAnswer(call: RecordedRequest, asked: Asked, library: FakeLibrary): unknown {
  return JSON_ANSWERS.get(callOf(call))?.(library, asked) ?? assetAnswer(library, asked.location)
}

// The detail of a photo, with its caption.
function assetAnswer(library: FakeLibrary, location: URL): unknown {
  const id = ASSET.exec(location.pathname)?.[1]
  return id === undefined ? undefined : assetOf(library, decodeURIComponent(id))
}

// Only the sizes a TV asks for: never the original.
function answerImage(url: URL, response: ServerResponse, options: FakeImmichOptions): void {
  const size = url.searchParams.get('size') ?? ''
  const photoId = THUMBNAIL.exec(url.pathname)?.[1]
  if (photoId !== undefined && IMAGE_SIZES.has(size)) {
    response.writeHead(200, { 'Content-Type': 'image/png' }).end(options.image(photoId, size))
    return
  }
  response.writeHead(404, { 'Content-Type': 'application/json' }).end('{"message":"Not found"}')
}
