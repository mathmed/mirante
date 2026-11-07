import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { API_KEY, fakeServer, IMMICH_URL, serveChanges } from '../../test/fake-immich.ts'
import type { FakeLibrary } from '../../test/immich-answers.ts'
import { failureOf, libraryErrorOf } from '../../test/library-failure.ts'
import { EditPermission, type LibraryEditor } from '../core/library-editor.ts'
import { LibraryFailure, PhotoOrder } from '../core/photo-library.ts'
import { DEFAULT_PRESENTATION } from '../core/presentation-settings.ts'
import { createImmichEditor } from './immich-editor.ts'

const TIMEOUT_MS = 5000
const API = `${IMMICH_URL}/api`
// Immich takes version 4 UUIDs alone.
const PHOTO_A = '0b9f3c1e-3f4a-4c2d-9d1e-2a3b4c5d6e7f'
const PHOTO_B = '6a7b8c9d-1e2f-4a3b-8c4d-5e6f7a8b9c0d'
const ALBUM = 'c3d4e5f6-a7b8-4c9d-ae0f-1a2b3c4d5e6f'
const CREATED = 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b'
const TAKEN_AT = '2024-03-20T12:00:00.000Z'

const LIBRARY: FakeLibrary = {
  albums: [{ id: ALBUM, name: 'Viagem a Lisboa' }],
  assets: [
    { id: PHOTO_A, takenAt: TAKEN_AT, offsetHours: 0, isImage: true, albumIds: [ALBUM] },
    { id: PHOTO_B, takenAt: TAKEN_AT, offsetHours: 0, isImage: true, albumIds: [] },
  ],
}

// Every permission the app needs, as Immich names them.
const WRITE_PERMISSIONS = [
  'asset.delete',
  'album.create',
  'album.update',
  'album.delete',
  'albumAsset.create',
  'albumAsset.delete',
]

interface Served {
  readonly permissions: readonly string[] | undefined
  readonly isTrashKept: boolean
}

const WRITING: Served = { permissions: WRITE_PERMISSIONS, isTrashKept: true }

function served({ permissions, isTrashKept }: Served = WRITING): ReturnType<typeof serveChanges> {
  return serveChanges({ library: LIBRARY, permissions, isTrashKept, albumIds: [CREATED] })
}

// Behind the proxy, which adds the key of the changes: the app sends none.
function editor(apiKey?: string): LibraryEditor {
  const config = { immichUrl: IMMICH_URL, presentation: DEFAULT_PRESENTATION }
  return createImmichEditor({
    config: apiKey === undefined ? config : { ...config, apiKey },
    timeoutMs: TIMEOUT_MS,
  })
}

function sent(calls: ReturnType<typeof serveChanges>['calls']): readonly string[] {
  return calls.map(({ method, path, body }) => `${method} ${path} ${body}`.trim())
}

describe('the changes to Immich, as the proxy lets them through', () => {
  it('should send photos to the trash, never away for good', async () => {
    const server = served()

    await editor().trashPhotos([PHOTO_A, PHOTO_B])

    expect(sent(server.calls)).toStrictEqual([
      `DELETE /api/assets {"ids":["${PHOTO_A}","${PHOTO_B}"],"force":false}`,
    ])
    expect(server.writes.library.assets.map((asset) => asset.isTrashed)).toStrictEqual([true, true])
  })

  it('should restore photos from the trash, and those photos alone', async () => {
    const server = served()
    await editor().trashPhotos([PHOTO_A])

    await editor().restorePhotos([PHOTO_A])

    expect(sent(server.calls)[1]).toBe(`POST /api/trash/restore/assets {"ids":["${PHOTO_A}"]}`)
    expect(server.writes.library.assets[0]?.isTrashed).toBe(false)
  })

  it('should create an album with its photos, and read back what Immich made', async () => {
    const server = served()

    const album = await editor().createAlbum('Férias "de verão"', [PHOTO_B])

    expect(sent(server.calls)).toStrictEqual([
      `POST /api/albums {"albumName":"Férias \\"de verão\\"","assetIds":["${PHOTO_B}"]}`,
    ])
    expect(album).toStrictEqual({
      id: CREATED,
      name: 'Férias "de verão"',
      photoCount: 1,
      coverPhotoId: PHOTO_B,
      order: PhotoOrder.NewestFirst,
      lastPhotoAtMs: Date.parse(TAKEN_AT),
    })
  })

  it('should create an empty album', async () => {
    const server = served()

    const album = await editor().createAlbum('Vazio', [])

    expect(sent(server.calls)).toStrictEqual([
      'POST /api/albums {"albumName":"Vazio","assetIds":[]}',
    ])
    expect(album.photoCount).toBe(0)
  })

  it('should rename an album, and nothing else of it', async () => {
    const server = served()

    await editor().renameAlbum(ALBUM, 'Lisboa')

    expect(sent(server.calls)).toStrictEqual([`PATCH /api/albums/${ALBUM} {"albumName":"Lisboa"}`])
    expect(server.writes.library.albums[0]?.name).toBe('Lisboa')
  })

  it('should delete an album without a body, its photos left in the library', async () => {
    const server = served()

    await editor().deleteAlbum(ALBUM)

    expect(sent(server.calls)).toStrictEqual([`DELETE /api/albums/${ALBUM}`])
    expect(server.writes.library.albums).toStrictEqual([])
    expect(server.writes.library.assets).toHaveLength(2)
  })

  it('should add photos to an album, those already in it as well', async () => {
    const server = served()

    await editor().addToAlbum(ALBUM, [PHOTO_A, PHOTO_B])

    expect(sent(server.calls)).toStrictEqual([
      `PUT /api/albums/${ALBUM}/assets {"ids":["${PHOTO_A}","${PHOTO_B}"]}`,
    ])
    expect(server.writes.library.assets[1]?.albumIds).toStrictEqual([ALBUM])
  })

  it('should take photos out of an album, those already out of it as well', async () => {
    const server = served()

    await editor().removeFromAlbum(ALBUM, [PHOTO_A, PHOTO_B])

    expect(sent(server.calls)).toStrictEqual([
      `DELETE /api/albums/${ALBUM}/assets {"ids":["${PHOTO_A}","${PHOTO_B}"]}`,
    ])
    expect(server.writes.library.assets[0]?.albumIds).toStrictEqual([])
  })

  it('should send no key, for the proxy to add the key of the changes', async () => {
    const server = served()

    await editor().trashPhotos([PHOTO_A])
    await editor(API_KEY).restorePhotos([PHOTO_A])

    expect(server.calls.map((call) => call.apiKey)).toStrictEqual([null, API_KEY])
  })
})

describe('a change Immich refuses', () => {
  it('should fail when Immich refuses an id, as it refuses any that is not a UUID', async () => {
    const server = served()

    const error = await libraryErrorOf(editor().trashPhotos(['photo-1']))

    expect(error.failure).toBe(LibraryFailure.ServerError)
    expect(error.message).toBe('HTTP 400: Validation failed (ids: Invalid ids)')
    expect(server.writes.library).toBe(LIBRARY)
  })

  it('should fail when a photo cannot be added, for another reason than being there', async () => {
    served()

    const error = await libraryErrorOf(editor().addToAlbum(ALBUM, [CREATED, PHOTO_B]))

    expect(error.failure).toBe(LibraryFailure.ServerError)
    expect(error.message).toBe('Immich refused 1 of 2 photos: not_found')
  })

  it('should fail when a photo cannot be taken out, for another reason than being out', async () => {
    fakeServer.use(
      http.delete(`${API}/albums/${ALBUM}/assets`, () =>
        HttpResponse.json([
          { id: PHOTO_A, success: false, error: 'no_permission' },
          { id: PHOTO_B, success: false, error: 'not_found' },
        ]),
      ),
    )

    const error = await libraryErrorOf(editor().removeFromAlbum(ALBUM, [PHOTO_A, PHOTO_B]))

    expect(error.message).toBe('Immich refused 1 of 2 photos: no_permission')
  })

  it('should log the text of a proxy that does not let the change through', async () => {
    fakeServer.use(
      http.delete(`${API}/assets`, () =>
        HttpResponse.text(' Caminho não permitido pelo proxy do Mirante.\n', { status: 403 }),
      ),
    )

    const error = await libraryErrorOf(editor().trashPhotos([PHOTO_A]))

    expect(error.failure).toBe(LibraryFailure.KeyMissing)
    expect(error.message).toBe('HTTP 403: Caminho não permitido pelo proxy do Mirante.')
  })

  it('should keep a short part of a long page of an error', async () => {
    fakeServer.use(
      http.delete(`${API}/albums/${ALBUM}`, () =>
        HttpResponse.text(`<html>${'x'.repeat(400)}</html>`, { status: 502 }),
      ),
    )

    const error = await libraryErrorOf(editor().deleteAlbum(ALBUM))

    expect(error.failure).toBe(LibraryFailure.ServerError)
    expect(error.message).toBe(`HTTP 502: <html>${'x'.repeat(194)}`)
  })

  it('should fail as a refused key when the key lacks the permission', async () => {
    served({ ...WRITING, permissions: ['album.read'] })

    expect(await failureOf(editor().deleteAlbum(ALBUM))).toBe(LibraryFailure.KeyMissing)
    expect(await failureOf(editor(API_KEY).deleteAlbum(ALBUM))).toBe(LibraryFailure.KeyRejected)
  })

  it('should fail as foreign when Immich answers anything but a list of results', async () => {
    fakeServer.use(
      http.put(`${API}/albums/${ALBUM}/assets`, () => HttpResponse.json({ success: true })),
    )

    expect(await failureOf(editor().addToAlbum(ALBUM, [PHOTO_A]))).toBe(LibraryFailure.NotImmich)
  })
})

describe('readGrant', () => {
  it('should read the permissions of the key of the changes, and the trash of Immich', async () => {
    const server = served()

    expect(await editor().readGrant()).toStrictEqual({
      permissions: new Set(Object.values(EditPermission)),
      isTrashKept: true,
    })
    expect(sent(server.calls)).toStrictEqual(['GET /api/api-keys/me', 'GET /api/server/features'])
  })

  it('should take a key with every permission of Immich as allowed everything', async () => {
    served({ ...WRITING, permissions: ['all'] })

    expect((await editor().readGrant()).permissions).toStrictEqual(
      new Set(Object.values(EditPermission)),
    )
  })

  it('should keep the permissions of the changes alone, and say when the trash is off', async () => {
    served({ permissions: ['album.read', 'asset.view', 'albumAsset.create'], isTrashKept: false })

    expect(await editor().readGrant()).toStrictEqual({
      permissions: new Set([EditPermission.AddToAlbum]),
      isTrashKept: false,
    })
  })

  it('should find no key of the changes when the proxy sends none, or refuses the route', async () => {
    const server = served({ ...WRITING, permissions: undefined })
    expect(await editor().readGrant()).toStrictEqual({ permissions: undefined, isTrashKept: false })
    expect(sent(server.calls)).toStrictEqual(['GET /api/api-keys/me'])

    fakeServer.use(
      http.get(`${API}/api-keys/me`, () =>
        HttpResponse.text('Caminho não permitido pelo proxy do Mirante.', { status: 403 }),
      ),
    )
    expect((await editor(API_KEY).readGrant()).permissions).toBeUndefined()
  })

  it('should fail when Immich cannot tell', async () => {
    served()
    fakeServer.use(
      http.get(`${API}/api-keys/me`, () => HttpResponse.json({ message: 'down' }, { status: 500 })),
    )

    expect(await failureOf(editor().readGrant())).toBe(LibraryFailure.ServerError)
  })

  it('should fail as foreign on answers that are not Immich', async () => {
    served()
    fakeServer.use(http.get(`${API}/api-keys/me`, () => HttpResponse.json({ permissions: 'all' })))
    expect(await failureOf(editor().readGrant())).toBe(LibraryFailure.NotImmich)

    fakeServer.use(
      http.get(`${API}/api-keys/me`, () => HttpResponse.json({ permissions: [] })),
      http.get(`${API}/server/features`, () => HttpResponse.json({ trash: 'yes' })),
    )
    expect(await failureOf(editor().readGrant())).toBe(LibraryFailure.NotImmich)
  })
})
