import type { Album } from './photo-library.ts'

// What the app may change in the photo library, whatever serves it: photos sent to the trash (and
// back), and albums created, renamed, deleted and filled. src/immich implements it with the Immich
// SDK, through the second key of the proxy, the one that writes; nothing is ever deleted for good.

// What a change needs the server to allow, one permission each.
export const EditPermission = {
  Trash: 'trash',
  CreateAlbum: 'create-album',
  RenameAlbum: 'rename-album',
  DeleteAlbum: 'delete-album',
  AddToAlbum: 'add-to-album',
  RemoveFromAlbum: 'remove-from-album',
} as const

export type EditPermission = (typeof EditPermission)[keyof typeof EditPermission]

// What the server says about the key of the changes, and about its trash.
export interface EditGrant {
  // Undefined when no key for the changes reached the server: the proxy has none, or refuses the
  // route that tells.
  readonly permissions: ReadonlySet<EditPermission> | undefined
  // Whether the server keeps what is deleted in its trash, where it can be restored from.
  readonly isTrashKept: boolean
}

export interface LibraryEditor {
  readonly readGrant: () => Promise<EditGrant>
  // To the trash, never for good.
  readonly trashPhotos: (photoIds: readonly string[]) => Promise<void>
  // Back from the trash.
  readonly restorePhotos: (photoIds: readonly string[]) => Promise<void>
  readonly createAlbum: (name: string, photoIds: readonly string[]) => Promise<Album>
  readonly renameAlbum: (albumId: string, name: string) => Promise<void>
  // The album alone: its photos stay in the library.
  readonly deleteAlbum: (albumId: string) => Promise<void>
  readonly addToAlbum: (albumId: string, photoIds: readonly string[]) => Promise<void>
  readonly removeFromAlbum: (albumId: string, photoIds: readonly string[]) => Promise<void>
}

// Why a kind of change is off.
export const AccessBlock = {
  // Not known yet: the visit just started.
  Checking: 'checking',
  // The proxy sends no key for the changes: the installation reads only.
  NoKey: 'no-key',
  // The key lacks a permission the change needs.
  MissingPermission: 'missing-permission',
  // The server deletes for good: the trash is off in its settings.
  TrashOff: 'trash-off',
  // The server could not tell.
  CheckFailed: 'check-failed',
} as const

export type AccessBlock = (typeof AccessBlock)[keyof typeof AccessBlock]

// What the app may change in this visit: each kind of change is on, or off with its reason.
export interface EditAccess {
  readonly albums: AccessBlock | undefined
  readonly trash: AccessBlock | undefined
}

export const CHECKING_ACCESS: EditAccess = {
  albums: AccessBlock.Checking,
  trash: AccessBlock.Checking,
}

export const FAILED_ACCESS: EditAccess = {
  albums: AccessBlock.CheckFailed,
  trash: AccessBlock.CheckFailed,
}

// Albums are managed whole: creating, renaming, deleting, filling and emptying them.
const ALBUM_PERMISSIONS: readonly EditPermission[] = [
  EditPermission.CreateAlbum,
  EditPermission.RenameAlbum,
  EditPermission.DeleteAlbum,
  EditPermission.AddToAlbum,
  EditPermission.RemoveFromAlbum,
]

export function editAccessOf({ permissions, isTrashKept }: EditGrant): EditAccess {
  if (permissions === undefined) {
    return { albums: AccessBlock.NoKey, trash: AccessBlock.NoKey }
  }
  const isAlbumsAllowed = ALBUM_PERMISSIONS.every((permission) => permissions.has(permission))
  return {
    albums: isAlbumsAllowed ? undefined : AccessBlock.MissingPermission,
    trash: trashBlockOf(permissions, isTrashKept),
  }
}

// The key must be allowed to delete, and the server must keep what is deleted in its trash: the app
// never deletes a photo for good.
function trashBlockOf(
  permissions: ReadonlySet<EditPermission>,
  isTrashKept: boolean,
): AccessBlock | undefined {
  if (!permissions.has(EditPermission.Trash)) {
    return AccessBlock.MissingPermission
  }
  return isTrashKept ? undefined : AccessBlock.TrashOff
}

// Whether anything at all can change: the bar of actions shows its buttons, or why there are none.
export function canEdit(access: EditAccess): boolean {
  return access.albums === undefined || access.trash === undefined
}
