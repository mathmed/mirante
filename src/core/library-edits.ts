import type { Album, Photo } from './photo-library.ts'

// The changes made in this visit, laid over what the screens read: the screen reacts at once, before
// the server answers, and a change the server refuses is taken back. Every edit is a set or a map
// keyed by id, so that laying it over a list read after the change (which already has it) changes
// nothing more.
export interface LibraryEdits {
  // Photos sent to the trash, or on their way: left out of every list.
  readonly trashed: ReadonlySet<string>
  // Photos taken out of an album, or on their way, by album id.
  readonly removed: ReadonlyMap<string, ReadonlySet<string>>
  // Albums created in this visit, the newest first; one on its way has a provisional id.
  readonly created: readonly Album[]
  // The new name of each album renamed, by id.
  readonly renamed: ReadonlyMap<string, string>
  readonly deleted: ReadonlySet<string>
}

export const NO_EDITS: LibraryEdits = {
  trashed: new Set(),
  removed: new Map(),
  created: [],
  renamed: new Map(),
  deleted: new Set(),
}

export const ChangeKind = {
  Trash: 'trash',
  Restore: 'restore',
  AddToAlbum: 'add-to-album',
  RemoveFromAlbum: 'remove-from-album',
  CreateAlbum: 'create-album',
  RenameAlbum: 'rename-album',
  DeleteAlbum: 'delete-album',
} as const

export type ChangeKind = (typeof ChangeKind)[keyof typeof ChangeKind]

interface PhotosChange<K extends ChangeKind> {
  readonly kind: K
  readonly photoIds: readonly string[]
}

interface AlbumPhotosChange<K extends ChangeKind> extends PhotosChange<K> {
  readonly album: Album
}

// One change asked for: what it acts on, as the screen showed it. The album created is the
// provisional one the screens show until the server answers.
export type Change =
  | PhotosChange<typeof ChangeKind.Trash>
  | PhotosChange<typeof ChangeKind.Restore>
  | AlbumPhotosChange<typeof ChangeKind.AddToAlbum>
  | AlbumPhotosChange<typeof ChangeKind.RemoveFromAlbum>
  | AlbumPhotosChange<typeof ChangeKind.CreateAlbum>
  | {
      readonly kind: typeof ChangeKind.RenameAlbum
      readonly album: Album
      readonly name: string
    }
  | { readonly kind: typeof ChangeKind.DeleteAlbum; readonly album: Album }

// What the screens show at once, as if the server had taken the change. Adding photos to an album
// shows nothing until the album is read again.
export function applyChange(edits: LibraryEdits, change: Change): LibraryEdits {
  switch (change.kind) {
    case ChangeKind.Trash:
      return { ...edits, trashed: withIds(edits.trashed, change.photoIds) }
    case ChangeKind.Restore:
      return { ...edits, trashed: withoutIds(edits.trashed, change.photoIds) }
    case ChangeKind.RemoveFromAlbum:
      return { ...edits, removed: removedWith(edits.removed, change.album.id, change.photoIds) }
    default:
      return applyAlbumChange(edits, change)
  }
}

// What the screens show again when the server refused the change.
export function revertChange(edits: LibraryEdits, change: Change): LibraryEdits {
  switch (change.kind) {
    case ChangeKind.Trash:
      return applyChange(edits, { kind: ChangeKind.Restore, photoIds: change.photoIds })
    case ChangeKind.Restore:
      return applyChange(edits, { kind: ChangeKind.Trash, photoIds: change.photoIds })
    case ChangeKind.RemoveFromAlbum:
      return { ...edits, removed: removedWithout(edits.removed, change.album.id, change.photoIds) }
    default:
      return revertAlbumChange(edits, change)
  }
}

// The album the server created takes the place of the provisional one.
export function settleCreated(edits: LibraryEdits, provisional: Album, album: Album): LibraryEdits {
  return {
    ...edits,
    created: edits.created.map((candidate) =>
      candidate.id === provisional.id ? album : candidate,
    ),
  }
}

// The photos of a list as the changes left them; those of an album, without the ones taken out of it.
export function visiblePhotos(
  photos: readonly Photo[],
  edits: LibraryEdits,
  albumId?: string,
): readonly Photo[] {
  const removed = albumId === undefined ? undefined : edits.removed.get(albumId)
  return photos.filter((photo) => !edits.trashed.has(photo.id) && removed?.has(photo.id) !== true)
}

// The albums read, renamed, without the deleted ones, after those created in this visit that the
// read does not have yet.
export function visibleAlbums(albums: readonly Album[], edits: LibraryEdits): readonly Album[] {
  const read = new Set(albums.map((album) => album.id))
  const created = edits.created.filter((album) => !read.has(album.id))
  return [...created, ...albums]
    .filter((album) => !edits.deleted.has(album.id))
    .map((album) => visibleAlbum(album, edits))
}

export function visibleAlbum(album: Album, edits: LibraryEdits): Album {
  const name = edits.renamed.get(album.id)
  return name === undefined ? album : { ...album, name }
}

type AlbumChange = Extract<
  Change,
  { readonly kind: 'add-to-album' | 'create-album' | 'delete-album' | 'rename-album' }
>

function applyAlbumChange(edits: LibraryEdits, change: AlbumChange): LibraryEdits {
  const { album } = change
  switch (change.kind) {
    case ChangeKind.CreateAlbum:
      return { ...edits, created: [album, ...edits.created] }
    case ChangeKind.RenameAlbum:
      return { ...edits, renamed: new Map(edits.renamed).set(album.id, change.name) }
    case ChangeKind.DeleteAlbum:
      return { ...edits, deleted: withIds(edits.deleted, [album.id]) }
    default:
      return edits
  }
}

// A rename taken back gives the album the name it had before, unless another rename came since.
function revertAlbumChange(edits: LibraryEdits, change: AlbumChange): LibraryEdits {
  const { album } = change
  switch (change.kind) {
    case ChangeKind.CreateAlbum:
      return { ...edits, created: edits.created.filter((created) => created.id !== album.id) }
    case ChangeKind.RenameAlbum:
      return edits.renamed.get(album.id) === change.name
        ? { ...edits, renamed: new Map(edits.renamed).set(album.id, album.name) }
        : edits
    case ChangeKind.DeleteAlbum:
      return { ...edits, deleted: withoutIds(edits.deleted, [album.id]) }
    default:
      return edits
  }
}

function withIds(ids: ReadonlySet<string>, added: readonly string[]): ReadonlySet<string> {
  return new Set([...ids, ...added])
}

function withoutIds(ids: ReadonlySet<string>, taken: readonly string[]): ReadonlySet<string> {
  const left = new Set(ids)
  taken.forEach((id) => left.delete(id))
  return left
}

function removedWith(
  removed: ReadonlyMap<string, ReadonlySet<string>>,
  albumId: string,
  photoIds: readonly string[],
): ReadonlyMap<string, ReadonlySet<string>> {
  return new Map(removed).set(albumId, withIds(removed.get(albumId) ?? new Set(), photoIds))
}

function removedWithout(
  removed: ReadonlyMap<string, ReadonlySet<string>>,
  albumId: string,
  photoIds: readonly string[],
): ReadonlyMap<string, ReadonlySet<string>> {
  return new Map(removed).set(albumId, withoutIds(removed.get(albumId) ?? new Set(), photoIds))
}
