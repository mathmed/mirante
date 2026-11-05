// A fake Immich behind the owner's proxy, on a real port, for the packaged app that a browser runs
// from file://: it answers CORS the way that proxy does (any origin, a 204 to the preflight, GET,
// HEAD, POST and OPTIONS), adds the key itself (it never asks for one) and records every request.
// One album of two photos, in one month.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

import {
  type AlbumResponseDto,
  AssetOrder,
  AssetVisibility,
  type TimeBucketAssetResponseDto,
} from '@immich/sdk'

import { encodePng } from '../scripts/packaging/png.ts'

export const ALBUM_NAME = 'Viagem a Lisboa'
export const PHOTO_IDS = ['photo-1', 'photo-2'] as const
const MONTH = '2024-03-01T00:00:00.000Z'
const TAKEN_AT = ['2024-03-09T10:00:00.000Z', '2024-03-10T12:00:00.000Z'] as const
const ALLOWED_METHODS = 'GET, HEAD, POST, OPTIONS'
// A small opaque image the browser decodes, so that a loaded <img> has a width.
const IMAGE = encodePng({ width: 4, height: 4, pixels: new Uint8Array(64).fill(200) })

interface RecordedRequest {
  readonly method: string
  readonly url: string
  readonly origin: string | undefined
  readonly apiKey: string | undefined
}

export interface FakeImmich {
  readonly url: string
  readonly requests: RecordedRequest[]
  // Whether it answers CORS; without it, a browser blocks every call from file://.
  isCorsAllowed: boolean
  readonly close: () => Promise<void>
}

const ALBUM: AlbumResponseDto = {
  id: 'album-trip',
  albumName: ALBUM_NAME,
  albumThumbnailAssetId: PHOTO_IDS[0],
  albumUsers: [],
  assetCount: PHOTO_IDS.length,
  createdAt: MONTH,
  description: '',
  hasSharedLink: false,
  isActivityEnabled: true,
  shared: false,
  updatedAt: MONTH,
  order: AssetOrder.Asc,
  startDate: TAKEN_AT[0],
  endDate: TAKEN_AT[1],
}

const BUCKET: TimeBucketAssetResponseDto = {
  id: [...PHOTO_IDS],
  isImage: [true, true],
  fileCreatedAt: [...TAKEN_AT],
  localOffsetHours: [0, 0],
  createdAt: [...TAKEN_AT],
  duration: [null, null],
  isFavorite: [false, false],
  isTrashed: [false, false],
  livePhotoVideoId: [null, null],
  ownerId: ['owner', 'owner'],
  projectionType: [null, null],
  ratio: [1, 1],
  thumbhash: [null, null],
  visibility: [AssetVisibility.Timeline, AssetVisibility.Timeline],
}

const JSON_ANSWERS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['GET /api/server/version', { major: 3, minor: 3, patch: 6, prerelease: null }],
  ['POST /api/auth/validateToken', { authStatus: true }],
  ['GET /api/albums', [ALBUM]],
  ['GET /api/timeline/buckets', [{ timeBucket: MONTH, count: PHOTO_IDS.length }]],
  ['GET /api/timeline/bucket', BUCKET],
])
const THUMBNAIL = /^\/api\/assets\/[^/]+\/thumbnail$/
const IMAGE_SIZES: ReadonlySet<string> = new Set(['thumbnail', 'preview'])

export async function startFakeImmich(): Promise<FakeImmich> {
  const requests: RecordedRequest[] = []
  const state = { isCorsAllowed: true }
  const server = createServer((request, response) => {
    requests.push(recorded(request))
    answer(request, response, state.isCorsAllowed)
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${String(port)}`,
    requests,
    get isCorsAllowed() {
      return state.isCorsAllowed
    },
    set isCorsAllowed(isAllowed: boolean) {
      state.isCorsAllowed = isAllowed
    },
    close: async () =>
      new Promise((resolve) => {
        server.close(() => {
          resolve()
        })
      }),
  }
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

function answer(request: IncomingMessage, response: ServerResponse, isCorsAllowed: boolean): void {
  if (isCorsAllowed) {
    response.setHeader('Access-Control-Allow-Origin', '*')
  }
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Methods': ALLOWED_METHODS }).end()
    return
  }
  const { method, url } = recorded(request)
  const location = new URL(url, 'http://immich.test')
  const body = JSON_ANSWERS.get(`${method} ${location.pathname}`)
  if (body !== undefined) {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
    return
  }
  answerImage(location, response)
}

// Only the sizes a TV asks for: never the original.
function answerImage(url: URL, response: ServerResponse): void {
  const size = url.searchParams.get('size') ?? ''
  if (THUMBNAIL.test(url.pathname) && IMAGE_SIZES.has(size)) {
    response.writeHead(200, { 'Content-Type': 'image/png' }).end(IMAGE)
    return
  }
  response.writeHead(404, { 'Content-Type': 'application/json' }).end('{"message":"Not found"}')
}
