import {
  AccessBlock,
  type EditGrant,
  EditPermission,
  type LibraryEditor,
} from '../src/core/library-editor.ts'
import { NO_EDITS } from '../src/core/library-edits.ts'
import type { Album } from '../src/core/photo-library.ts'
import type { EditingControls } from '../src/ui/use-editing.ts'

// The changes to a library for the tests of the core and of the components, which run without a
// server: every change the test does not give fails it. The adapter itself is tested against the
// fake server.
export function stubEditor(changes: Partial<LibraryEditor>): LibraryEditor {
  const unexpected = async (): Promise<never> => Promise.reject(new Error('unexpected change'))
  return {
    readGrant: unexpected,
    trashPhotos: unexpected,
    restorePhotos: unexpected,
    createAlbum: unexpected,
    renameAlbum: unexpected,
    deleteAlbum: unexpected,
    addToAlbum: unexpected,
    removeFromAlbum: unexpected,
    ...changes,
  }
}

// Every permission, and a trash: everything can change.
export const FULL_GRANT: EditGrant = {
  permissions: new Set(Object.values(EditPermission)),
  isTrashKept: true,
}

// No key for the changes: the installation reads only.
export const NO_GRANT: EditGrant = { permissions: undefined, isTrashKept: false }

export interface RecordingEditor {
  readonly editor: LibraryEditor
  // Each change, as "<call> <arguments as JSON>".
  readonly calls: string[]
}

// An editor that takes every change at once and records it; a created album gets the id
// "created-<n>".
export function recordingEditor(grant: EditGrant = FULL_GRANT): RecordingEditor {
  const calls: string[] = []
  const record = async (call: string, ...args: readonly unknown[]): Promise<void> => {
    calls.push(`${call} ${JSON.stringify(args)}`)
    return Promise.resolve()
  }
  const created = async (name: string, photoIds: readonly string[]): Promise<Album> => {
    await record('createAlbum', name, photoIds)
    return createdAlbum(name, photoIds, calls.length)
  }
  return {
    calls,
    editor: {
      readGrant: async () => Promise.resolve(grant),
      trashPhotos: async (ids) => record('trashPhotos', ids),
      restorePhotos: async (ids) => record('restorePhotos', ids),
      createAlbum: created,
      renameAlbum: async (id, name) => record('renameAlbum', id, name),
      deleteAlbum: async (id) => record('deleteAlbum', id),
      addToAlbum: async (id, ids) => record('addToAlbum', id, ids),
      removeFromAlbum: async (id, ids) => record('removeFromAlbum', id, ids),
    },
  }
}

function createdAlbum(name: string, photoIds: readonly string[], serial: number): Album {
  const album: Album = {
    id: `created-${String(serial)}`,
    name,
    photoCount: photoIds.length,
    order: 'newest-first',
  }
  const [cover] = photoIds
  return cover === undefined ? album : { ...album, coverPhotoId: cover }
}

// The changes of a screen that changes nothing: the installation reads only, and a change fails the
// test.
export const READ_ONLY_EDITING: EditingControls = {
  access: { albums: AccessBlock.NoKey, trash: AccessBlock.NoKey },
  edits: NO_EDITS,
  canUndo: false,
  commit: async () => Promise.reject(new Error('unexpected change')),
  undo: () => {
    throw new Error('unexpected undo')
  },
  notify: () => undefined,
  notice: undefined,
  nextSerial: () => 1,
  today: () => ({ year: 2026, month: 11, day: 7 }),
}
