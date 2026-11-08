import type { LibraryEditor } from './library-editor.ts'
import {
  applyChange,
  type Change,
  ChangeKind,
  type LibraryEdits,
  revertChange,
  settleCreated,
} from './library-edits.ts'
import { type LoadOutcome, LoadStatus, runLoad } from './loading.ts'

// Where the changes of the visit are kept: each update gets the edits as they are now, so that
// changes answered in any order never undo one another.
export interface EditStore {
  readonly update: (next: (edits: LibraryEdits) => LibraryEdits) => void
  readonly reportError: (error: unknown) => void
}

// A change, optimistic: the screens show it at once, the server is asked, and a refusal takes it
// back (the error goes to the log, the outcome tells the screen what to say).
export async function commitChange(
  editor: LibraryEditor,
  change: Change,
  store: EditStore,
): Promise<LoadOutcome<void>> {
  store.update((edits) => applyChange(edits, change))
  const outcome = await runLoad(async () => sendChange(editor, change, store), store.reportError)
  if (outcome.status === LoadStatus.Failed) {
    store.update((edits) => revertChange(edits, change))
  }
  return outcome
}

// The call that makes the change on the server.
async function sendChange(editor: LibraryEditor, change: Change, store: EditStore): Promise<void> {
  switch (change.kind) {
    case ChangeKind.Trash:
      return editor.trashPhotos(change.photoIds)
    case ChangeKind.Restore:
      return editor.restorePhotos(change.photoIds)
    case ChangeKind.AddToAlbum:
      return editor.addToAlbum(change.album.id, change.photoIds)
    case ChangeKind.RemoveFromAlbum:
      return editor.removeFromAlbum(change.album.id, change.photoIds)
    default:
      return sendAlbumChange(editor, change, store)
  }
}

// A created album takes the id the server gave it.
async function sendAlbumChange(
  editor: LibraryEditor,
  change: Extract<Change, { readonly kind: 'create-album' | 'delete-album' | 'rename-album' }>,
  store: EditStore,
): Promise<void> {
  switch (change.kind) {
    case ChangeKind.CreateAlbum: {
      const album = await editor.createAlbum(change.album.name, change.photoIds)
      store.update((edits) => settleCreated(edits, change.album, album))
      return undefined
    }
    case ChangeKind.RenameAlbum:
      return editor.renameAlbum(change.album.id, change.name)
    default:
      return editor.deleteAlbum(change.album.id)
  }
}
