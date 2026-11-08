import { BulkIdErrorReason, type BulkIdResponseDto } from '@immich/sdk'

import { albumOf, type FakeAlbum, type FakeAsset, type FakeLibrary } from './immich-answers.ts'

// The changes a fake Immich takes, checked as Immich 3.3.6 checks them (its zod schemas, read in
// its server): every id a version 4 UUID, every field of its type. A fake is stricter on one point:
// a field Immich would ignore is refused, so that the app sends only what it means. The fake server
// of the component tests (MSW) and the one of the end-to-end tests both answer with them, and keep
// what changed.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const KEY_DATE = '2026-11-07T00:00:00.000Z'
const ALBUM = /^\/api\/albums\/([0-9a-f-]{36})$/u
const ALBUM_ASSETS = /^\/api\/albums\/([0-9a-f-]{36})\/assets$/u

export interface WriteOptions {
  readonly library: FakeLibrary
  // The permissions of the key the proxy adds to the changes; undefined when it adds none.
  readonly permissions: readonly string[] | undefined
  readonly isTrashKept: boolean
  // The ids of the albums it creates, in turn.
  readonly albumIds: readonly string[]
}

export interface Call {
  readonly method: string
  // Without the query.
  readonly path: string
  // As sent: empty without a body.
  readonly body: string
}

export interface WriteAnswer {
  readonly status: number
  readonly body: unknown
}

type Body = Readonly<Record<string, unknown>>

// What a change asks: the id in its path, if any, and its body.
interface Asked {
  readonly id: string
  readonly body: Body
}

type Check = (value: unknown) => boolean

const isIdList: Check = (value) =>
  Array.isArray(value) && value.every((id) => typeof id === 'string' && UUID_V4.test(id))
const isText: Check = (value) => typeof value === 'string'
const isFlag: Check = (value) => typeof value === 'boolean'

interface Shape {
  readonly required: ReadonlyMap<string, Check>
  readonly optional: ReadonlyMap<string, Check>
}

const IDS: Shape = { required: new Map([['ids', isIdList]]), optional: new Map() }
const NO_BODY: Shape = { required: new Map(), optional: new Map() }

interface Route {
  readonly method: string
  readonly path: RegExp
  // The permission Immich asks of the key; undefined for a public route, '' for any key.
  readonly permission: string | undefined
  readonly shape: Shape
  readonly answer: (asked: Asked) => WriteAnswer
}

// How adding photos to an album, or taking them out, goes for each photo.
interface FillRule {
  // Why a photo of the library is not added (or taken out), if it is not.
  readonly refusalOf: (asset: FakeAsset, albumId: string) => BulkIdErrorReason | undefined
  readonly albumIdsAfter: (asset: FakeAsset, albumId: string) => readonly string[]
}

const ADDING: FillRule = {
  refusalOf: (asset, albumId) =>
    asset.albumIds.includes(albumId) ? BulkIdErrorReason.Duplicate : undefined,
  albumIdsAfter: (asset, albumId) => [...asset.albumIds, albumId],
}

const TAKING_OUT: FillRule = {
  refusalOf: (asset, albumId) =>
    asset.albumIds.includes(albumId) ? undefined : BulkIdErrorReason.NotFound,
  albumIdsAfter: (asset, albumId) => asset.albumIds.filter((id) => id !== albumId),
}

export class FakeWrites {
  library: FakeLibrary
  readonly #options: WriteOptions
  readonly #albumIds: string[]
  readonly #routes: readonly Route[]

  constructor(options: WriteOptions) {
    this.library = options.library
    this.#options = options
    this.#albumIds = [...options.albumIds]
    this.#routes = this.#routesOf()
  }

  // Undefined for a call that is no change (nor one of the two reads that tell what may change).
  answer(call: Call): WriteAnswer | undefined {
    const matched = this.#routes.find(
      (candidate) => candidate.method === call.method && candidate.path.test(call.path),
    )
    return matched === undefined ? undefined : this.#answerOf(matched, call)
  }

  #answerOf(matched: Route, call: Call): WriteAnswer {
    const id = matched.path.exec(call.path)?.[1] ?? ''
    const refusal = this.#keyRefusal(matched.permission) ?? bodyRefusal(matched.shape, call.body)
    return refusal ?? matched.answer({ id, body: parsed(call.body) })
  }

  #routesOf(): readonly Route[] {
    return [...this.#readRoutes(), ...this.#photoRoutes(), ...this.#albumRoutes()]
  }

  #readRoutes(): readonly Route[] {
    const { isTrashKept, permissions } = this.#options
    const key = { id: 'write-key', name: 'Mirante', createdAt: KEY_DATE, updatedAt: KEY_DATE }
    return [
      {
        method: 'GET',
        path: /^\/api\/server\/features$/u,
        permission: undefined,
        shape: NO_BODY,
        answer: () => ok({ trash: isTrashKept, search: true, map: false }),
      },
      {
        method: 'GET',
        path: /^\/api\/api-keys\/me$/u,
        permission: '',
        shape: NO_BODY,
        answer: () => ok({ ...key, permissions }),
      },
    ]
  }

  #photoRoutes(): readonly Route[] {
    return [
      {
        method: 'DELETE',
        path: /^\/api\/assets$/u,
        permission: 'asset.delete',
        shape: { required: IDS.required, optional: new Map([['force', isFlag]]) },
        answer: ({ body }) => this.#trash(idsOf(body), true),
      },
      {
        method: 'POST',
        path: /^\/api\/trash\/restore\/assets$/u,
        permission: 'asset.delete',
        shape: IDS,
        answer: ({ body }) => this.#trash(idsOf(body), false),
      },
    ]
  }

  #albumRoutes(): readonly Route[] {
    return [
      {
        method: 'POST',
        path: /^\/api\/albums$/u,
        permission: 'album.create',
        shape: {
          required: new Map([['albumName', isText]]),
          optional: new Map([['assetIds', isIdList]]),
        },
        answer: ({ body }) => this.#create(body),
      },
      {
        method: 'PATCH',
        path: ALBUM,
        permission: 'album.update',
        shape: { required: new Map(), optional: new Map([['albumName', isText]]) },
        answer: (asked) => this.#rename(asked),
      },
      ...this.#albumContentRoutes(),
    ]
  }

  #albumContentRoutes(): readonly Route[] {
    return [
      {
        method: 'DELETE',
        path: ALBUM,
        permission: 'album.delete',
        shape: NO_BODY,
        answer: ({ id }) => this.#delete(id),
      },
      {
        method: 'PUT',
        path: ALBUM_ASSETS,
        permission: 'albumAsset.create',
        shape: IDS,
        answer: (asked) => this.#fill(asked, ADDING),
      },
      {
        method: 'DELETE',
        path: ALBUM_ASSETS,
        permission: 'albumAsset.delete',
        shape: IDS,
        answer: (asked) => this.#fill(asked, TAKING_OUT),
      },
    ]
  }

  #keyRefusal(permission: string | undefined): WriteAnswer | undefined {
    const { permissions } = this.#options
    if (permission === undefined) {
      return undefined
    }
    if (permissions === undefined) {
      return { status: 401, body: { message: 'Authentication required', statusCode: 401 } }
    }
    return permission === '' || permissions.includes(permission)
      ? undefined
      : { status: 403, body: { message: `Missing required permission: ${permission}` } }
  }

  // Every id must be one of the library's, as Immich checks the owner of each.
  #trash(ids: readonly string[], isTrashed: boolean): WriteAnswer {
    if (!ids.every((id) => this.#asset(id) !== undefined)) {
      return { status: 400, body: { message: 'Not found or no asset.delete access' } }
    }
    this.#changeAssets((asset) => (ids.includes(asset.id) ? { ...asset, isTrashed } : asset))
    return isTrashed ? { status: 204, body: undefined } : ok({ count: ids.length })
  }

  #create(body: Body): WriteAnswer {
    const album: FakeAlbum = { id: this.#albumIds.shift() ?? '', name: String(body['albumName']) }
    const ids = idsOf(body)
    this.library = { ...this.library, albums: [...this.library.albums, album] }
    this.#changeAssets((asset) =>
      ids.includes(asset.id) ? { ...asset, albumIds: [...asset.albumIds, album.id] } : asset,
    )
    return { status: 201, body: albumOf(this.library, album) }
  }

  #rename({ id, body }: Asked): WriteAnswer {
    const album = this.#album(id)
    if (album === undefined) {
      return notFound()
    }
    const renamed = {
      ...album,
      name: typeof body['albumName'] === 'string' ? body['albumName'] : album.name,
    }
    const albums = this.library.albums.map((candidate) =>
      candidate.id === id ? renamed : candidate,
    )
    this.library = { ...this.library, albums }
    return ok(albumOf(this.library, renamed))
  }

  // The album alone: its assets stay in the library.
  #delete(id: string): WriteAnswer {
    if (this.#album(id) === undefined) {
      return notFound()
    }
    this.library = {
      ...this.library,
      albums: this.library.albums.filter((album) => album.id !== id),
    }
    this.#changeAssets((asset) => ({ ...asset, albumIds: TAKING_OUT.albumIdsAfter(asset, id) }))
    return { status: 204, body: undefined }
  }

  // One result per id: added (or taken out), or why not.
  #fill({ id, body }: Asked, rule: FillRule): WriteAnswer {
    if (this.#album(id) === undefined) {
      return notFound()
    }
    const results = idsOf(body).map((assetId) => this.#resultOf(assetId, id, rule))
    const done = new Set(results.filter((result) => result.success).map((result) => result.id))
    this.#changeAssets((asset) =>
      done.has(asset.id) ? { ...asset, albumIds: rule.albumIdsAfter(asset, id) } : asset,
    )
    return ok(results)
  }

  #resultOf(assetId: string, albumId: string, rule: FillRule): BulkIdResponseDto {
    const asset = this.#asset(assetId)
    const error = asset === undefined ? BulkIdErrorReason.NotFound : rule.refusalOf(asset, albumId)
    return error === undefined
      ? { id: assetId, success: true }
      : { id: assetId, success: false, error }
  }

  #asset(id: string): FakeAsset | undefined {
    return this.library.assets.find((asset) => asset.id === id)
  }

  #album(id: string): FakeAlbum | undefined {
    return this.library.albums.find((album) => album.id === id)
  }

  #changeAssets(change: (asset: FakeAsset) => FakeAsset): void {
    this.library = { ...this.library, assets: this.library.assets.map(change) }
  }
}

function bodyRefusal(shape: Shape, text: string): WriteAnswer | undefined {
  const body = parsed(text)
  const missing = [...shape.required.keys()].filter((field) => !(field in body))
  const invalid = Object.entries(body)
    .filter(([field, value]) => !isValid(shape, field, value))
    .map(([field]) => field)
  const problems = [
    ...missing.map((field) => ({ path: [field], message: 'Required' })),
    ...invalid.map((field) => ({ path: [field], message: `Invalid ${field}` })),
  ]
  return problems.length === 0 ? undefined : validation(problems)
}

function isValid(shape: Shape, field: string, value: unknown): boolean {
  const check = shape.required.get(field) ?? shape.optional.get(field)
  return check?.(value) === true
}

function validation(errors: readonly { path: readonly string[]; message: string }[]): WriteAnswer {
  const reasons = errors.map((error) => ({ code: 'custom', ...error }))
  return { status: 400, body: { message: 'Validation failed', errors: reasons, statusCode: 400 } }
}

// A body that is no JSON object is refused as one field without a name.
function parsed(text: string): Body {
  const body: unknown = text === '' ? {} : JSON.parse(text)
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Body)
    : { '': body }
}

function idsOf(body: Body): readonly string[] {
  const ids: unknown = body['ids'] ?? body['assetIds'] ?? []
  return ids as readonly string[]
}

function ok(body: unknown): WriteAnswer {
  return { status: 200, body }
}

function notFound(): WriteAnswer {
  return { status: 400, body: { message: 'Not found or no album access' } }
}
