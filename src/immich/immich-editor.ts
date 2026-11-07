import {
  addAssetsToAlbum,
  type ApiKeyResponseDto,
  BulkIdErrorReason,
  type BulkIdResponseDto,
  createAlbum,
  deleteAlbum,
  deleteAssets,
  getMyApiKey,
  getServerFeatures,
  Permission,
  removeAssetFromAlbum,
  restoreAssets,
  type ServerFeaturesDto,
  updateAlbumInfo,
} from '@immich/sdk'

import { type EditGrant, EditPermission, type LibraryEditor } from '../core/library-editor.ts'
import { LibraryFailure, PhotoLibraryError } from '../core/photo-library.ts'
import { albumOf } from './immich-assets.ts'
import { type ImmichLibraryOptions, malformed, request } from './immich-request.ts'

// What each permission of an Immich key lets the app change; "all" lets it change everything.
const PERMISSIONS: ReadonlyMap<string, readonly EditPermission[]> = new Map([
  [Permission.All, Object.values(EditPermission)],
  [Permission.AssetDelete, [EditPermission.Trash]],
  [Permission.AlbumCreate, [EditPermission.CreateAlbum]],
  [Permission.AlbumUpdate, [EditPermission.RenameAlbum]],
  [Permission.AlbumDelete, [EditPermission.DeleteAlbum]],
  [Permission.AlbumAssetCreate, [EditPermission.AddToAlbum]],
  [Permission.AlbumAssetDelete, [EditPermission.RemoveFromAlbum]],
])

// A failure the app shrugs off for one photo: already in the album, or already out of it.
const ALREADY_ADDED: ReadonlySet<string> = new Set([BulkIdErrorReason.Duplicate])
const ALREADY_REMOVED: ReadonlySet<string> = new Set([BulkIdErrorReason.NotFound])

// The changes to the library, through the second key of the proxy, the one that writes: every call
// passes the address of the configuration (and its key, when it has one), never the SDK's global
// defaults. A photo goes to the trash, never away for good (force is always false), and comes back
// from it; an album is created, renamed, deleted (its photos stay) and filled. The proxy lets these
// calls through with their exact bodies only (docs/proxy.md).
export function createImmichEditor(options: ImmichLibraryOptions): LibraryEditor {
  return {
    readGrant: async () => readGrant(options),
    ...photoChanges(options),
    ...albumChanges(options),
  }
}

type PhotoChanges = Pick<LibraryEditor, 'restorePhotos' | 'trashPhotos'>

function photoChanges(options: ImmichLibraryOptions): PhotoChanges {
  return {
    trashPhotos: async (photoIds) => {
      const assetBulkDeleteDto = { ids: [...photoIds], force: false }
      await request(options, async (call) => deleteAssets({ assetBulkDeleteDto }, call))
    },
    restorePhotos: async (photoIds) => {
      const bulkIdsDto = { ids: [...photoIds] }
      await request(options, async (call) => restoreAssets({ bulkIdsDto }, call))
    },
  }
}

type AlbumChanges = Omit<LibraryEditor, keyof PhotoChanges | 'readGrant'>

function albumChanges(options: ImmichLibraryOptions): AlbumChanges {
  return {
    createAlbum: async (albumName, photoIds) => {
      const createAlbumDto = { albumName, assetIds: [...photoIds] }
      return albumOf(await request(options, async (call) => createAlbum({ createAlbumDto }, call)))
    },
    renameAlbum: async (id, albumName) => {
      const updateAlbumDto = { albumName }
      await request(options, async (call) => updateAlbumInfo({ id, updateAlbumDto }, call))
    },
    deleteAlbum: async (id) => request(options, async (call) => deleteAlbum({ id }, call)),
    addToAlbum: async (id, photoIds) => {
      const bulkIdsDto = { ids: [...photoIds] }
      checkEach(
        await request(options, async (call) => addAssetsToAlbum({ id, bulkIdsDto }, call)),
        ALREADY_ADDED,
      )
    },
    removeFromAlbum: async (id, photoIds) => {
      const bulkIdsDto = { ids: [...photoIds] }
      checkEach(
        await request(options, async (call) => removeAssetFromAlbum({ id, bulkIdsDto }, call)),
        ALREADY_REMOVED,
      )
    },
  }
}

// The permissions of the key the proxy sends for the changes, and whether Immich keeps a trash:
// asked only when there is such a key, for a proxy without one refuses every other route too.
async function readGrant(options: ImmichLibraryOptions): Promise<EditGrant> {
  const permissions = await keyPermissions(options)
  if (permissions === undefined) {
    return { permissions, isTrashKept: false }
  }
  return { permissions, isTrashKept: await trashKept(options) }
}

// Undefined when Immich got no key, or one it refuses, or the proxy refuses the route: the
// installation reads only. Telling the key's permissions changes nothing and needs none.
async function keyPermissions(
  options: ImmichLibraryOptions,
): Promise<ReadonlySet<EditPermission> | undefined> {
  try {
    return permissionsOf(await request(options, getMyApiKey))
  } catch (error) {
    if (isRefusedKey(error)) {
      return undefined
    }
    throw error
  }
}

function isRefusedKey(error: unknown): boolean {
  return (
    error instanceof PhotoLibraryError &&
    (error.failure === LibraryFailure.KeyMissing || error.failure === LibraryFailure.KeyRejected)
  )
}

function permissionsOf(key: ApiKeyResponseDto): ReadonlySet<EditPermission> {
  const permissions: unknown = key.permissions
  if (!Array.isArray(permissions)) {
    throw malformed('key permissions')
  }
  const granted = permissions.map((permission) => PERMISSIONS.get(String(permission)) ?? [])
  return new Set(([] as EditPermission[]).concat(...granted))
}

// The features of the server are public: no key is needed to read them.
async function trashKept(options: ImmichLibraryOptions): Promise<boolean> {
  const features: ServerFeaturesDto = await request(options, getServerFeatures)
  const trash: unknown = features.trash
  if (typeof trash !== 'boolean') {
    throw malformed('server features')
  }
  return trash
}

// Immich answers a change to many photos with one result each: a photo it refused (for another
// reason than one the app shrugs off) fails the whole change, which the screen takes back.
function checkEach(answer: readonly BulkIdResponseDto[], tolerated: ReadonlySet<string>): void {
  const results: unknown = answer
  if (!Array.isArray(results)) {
    throw malformed('results')
  }
  const refused = answer.filter((result) => !result.success && !tolerated.has(String(result.error)))
  if (refused.length > 0) {
    const reasons = refused.map((result) => String(result.error)).join(', ')
    throw new PhotoLibraryError(
      LibraryFailure.ServerError,
      `Immich refused ${String(refused.length)} of ${String(answer.length)} photos: ${reasons}`,
    )
  }
}
