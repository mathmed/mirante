// A fake Immich behind the owner's proxy, on a real port, for the app that a browser runs from
// file://: it answers CORS the way that proxy does (any origin, a 204 to the preflight, the methods
// of the reads and of the changes, and the Content-Type header of the JSON bodies), adds the keys
// itself (it never asks for one) and records every request, with its body. It serves a library (by
// default, one album of two photos, in one month), its random draws, its searches by date and
// captions, and the images an option draws (by default, a small gray square). The changes to the
// library go through the key of the changes, which the proxy holds once grantWrites gives its
// permissions (none at first: the installation reads only), checked as Immich 3.3.6 checks them
// (test/immich-writes.ts), and kept.
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
  searchRejectionOf,
} from '../test/immich-answers.ts'
import { FakeWrites } from '../test/immich-writes.ts'

export const ALBUM_NAME = 'Viagem a Lisboa'
export const CAPTION = 'Bom dia, Lisboa'
// Immich's ids are version 4 UUIDs, and the changes take nothing else.
export const PHOTO_IDS = [
  '0b9f3c1e-3f4a-4c2d-9d1e-2a3b4c5d6e7f',
  '6a7b8c9d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
] as const
export const ALBUM_ID = 'c3d4e5f6-a7b8-4c9d-ae0f-1a2b3c4d5e6f'
// The ids of the albums it creates, in turn.
const CREATED_ALBUM_IDS = ['e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b']
const ALLOWED_METHODS = 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type'
// What the app draws for each round of the whole library.
const DRAW_SIZE = 200
const VERSION = { major: 3, minor: 3, patch: 6, prerelease: null }
// A small opaque image the browser decodes, so that a loaded <img> has a width.
const IMAGE = encodePng({ width: 4, height: 4, pixels: new Uint8Array(64).fill(200) })

const TRIP_LIBRARY: FakeLibrary = {
  albums: [{ id: ALBUM_ID, name: ALBUM_NAME, isOldestFirst: true }],
  assets: [
    {
      id: PHOTO_IDS[0],
      takenAt: '2024-03-09T10:00:00.000Z',
      offsetHours: 0,
      isImage: true,
      albumIds: [ALBUM_ID],
      description: CAPTION,
    },
    {
      id: PHOTO_IDS[1],
      takenAt: '2024-03-10T12:00:00.000Z',
      offsetHours: 0,
      isImage: true,
      albumIds: [ALBUM_ID],
    },
  ],
}

// What a request asks for: its address, and the JSON body it sends, if any.
interface Asked {
  readonly location: URL
  readonly body: unknown
}

const SEARCH_CALL = 'POST /api/search/metadata'

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
  [SEARCH_CALL, (library, { body }) => searchedOf(library, body)],
])

const ASSET = /^\/api\/assets\/([^/]+)$/

const THUMBNAIL = /^\/api\/assets\/([^/]+)\/thumbnail$/
const IMAGE_SIZES: ReadonlySet<string> = new Set(['thumbnail', 'preview'])

interface RecordedRequest {
  readonly method: string
  readonly url: string
  readonly origin: string | undefined
  readonly apiKey: string | undefined
  // As sent: empty for most.
  readonly body: string
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
  // The proxy holds a key for the changes, with these permissions of Immich (undefined: no key),
  // over the library as it started.
  readonly grantWrites: (permissions: readonly string[] | undefined) => void
  readonly close: () => Promise<void>
}

export async function startFakeImmich(
  options: FakeImmichOptions = { library: TRIP_LIBRARY, image: () => IMAGE },
): Promise<FakeImmich> {
  const requests: RecordedRequest[] = []
  const delaysMs = new Map<string, number>()
  const settings = { isCorsAllowed: true, writes: writesOf(options.library, undefined) }
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const call = recorded(request, Buffer.concat(chunks).toString('utf8'))
      requests.push(call)
      setTimeout(
        () => {
          answer({ request, response, options, call, ...settings })
        },
        delaysMs.get(callOf(call)) ?? 0,
      )
    })
  })
  const url = `http://127.0.0.1:${String(await listen(server))}`
  // The library as it started, whatever the changes made before.
  const grantWrites = (permissions: readonly string[] | undefined): void => {
    settings.writes = writesOf(options.library, permissions)
  }
  const close = async (): Promise<void> => closed(server)
  return Object.assign(settings, { url, requests, delaysMs, grantWrites, close })
}

function writesOf(library: FakeLibrary, permissions: readonly string[] | undefined): FakeWrites {
  return new FakeWrites({ library, permissions, isTrashKept: true, albumIds: CREATED_ALBUM_IDS })
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

function recorded(request: IncomingMessage, body: string): RecordedRequest {
  const apiKey = request.headers['x-api-key']
  return {
    method: request.method ?? '',
    url: request.url ?? '/',
    origin: request.headers.origin,
    apiKey: typeof apiKey === 'string' ? apiKey : undefined,
    body,
  }
}

interface Exchange {
  readonly request: IncomingMessage
  readonly response: ServerResponse
  readonly options: FakeImmichOptions
  readonly isCorsAllowed: boolean
  readonly call: RecordedRequest
  // The changes, and the library as they left it.
  readonly writes: FakeWrites
}

function answer(exchange: Exchange): void {
  const { request, response, isCorsAllowed } = exchange
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
  answerCall(exchange)
}

// A change, or a read of JSON, or an image.
function answerCall({ response, call, writes, options }: Exchange): void {
  const location = new URL(call.url, 'http://immich.test')
  const changed = writes.answer({ method: call.method, path: location.pathname, body: call.body })
  const parsed: unknown = call.body === '' ? undefined : JSON.parse(call.body)
  const reply = changed ?? jsonReply(call, { location, body: parsed }, writes.library)
  if (reply === undefined) {
    answerImage(location, response, options)
  } else {
    send(response, reply)
  }
}

// A change that answers nothing has no body (Immich's 204).
function send(response: ServerResponse, reply: JsonReply): void {
  if (reply.body === undefined) {
    response.writeHead(reply.status).end()
    return
  }
  response
    .writeHead(reply.status, { 'Content-Type': 'application/json' })
    .end(JSON.stringify(reply.body))
}

interface JsonReply {
  readonly status: number
  readonly body: unknown
}

// The JSON a call gets, if any: a search Immich 3.3.6 refuses gets its 400 and the reasons.
function jsonReply(
  call: RecordedRequest,
  asked: Asked,
  library: FakeLibrary,
): JsonReply | undefined {
  const rejection = callOf(call) === SEARCH_CALL ? searchRejectionOf(asked.body) : undefined
  if (rejection !== undefined) {
    return { status: 400, body: rejection }
  }
  const body = jsonAnswer(call, asked, library)
  return body === undefined ? undefined : { status: 200, body }
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
