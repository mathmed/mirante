import { describe, expect, it } from 'vitest'

import { recordingEditor, stubEditor } from '../../test/editor-stub.ts'
import { commitChange, type EditStore } from './edit-commit.ts'
import { type Change, ChangeKind, type LibraryEdits, NO_EDITS } from './library-edits.ts'
import { LoadFailure, LoadStatus } from './loading.ts'
import { LibraryFailure, PhotoLibraryError, PhotoOrder } from './photo-library.ts'

const TRIP = { id: 'trip', name: 'Viagem', photoCount: 2, order: PhotoOrder.OldestFirst }
const NEW = { id: 'new-album-1', name: 'Nova', photoCount: 1, order: PhotoOrder.NewestFirst }

interface Store extends EditStore {
  readonly edits: () => LibraryEdits
  // The edits after each update, in order.
  readonly history: LibraryEdits[]
  readonly reported: unknown[]
}

function store(): Store {
  const history: LibraryEdits[] = []
  const reported: unknown[] = []
  let current = NO_EDITS
  return {
    history,
    reported,
    edits: () => current,
    update: (next) => {
      current = next(current)
      history.push(current)
    },
    reportError: (error) => reported.push(error),
  }
}

const CHANGES: readonly (readonly [Change, string])[] = [
  [{ kind: ChangeKind.Trash, photoIds: ['a', 'b'] }, 'trashPhotos [["a","b"]]'],
  [{ kind: ChangeKind.Restore, photoIds: ['a'] }, 'restorePhotos [["a"]]'],
  [{ kind: ChangeKind.AddToAlbum, album: TRIP, photoIds: ['a'] }, 'addToAlbum ["trip",["a"]]'],
  [
    { kind: ChangeKind.RemoveFromAlbum, album: TRIP, photoIds: ['b'] },
    'removeFromAlbum ["trip",["b"]]',
  ],
  [{ kind: ChangeKind.CreateAlbum, album: NEW, photoIds: ['a'] }, 'createAlbum ["Nova",["a"]]'],
  [{ kind: ChangeKind.RenameAlbum, album: TRIP, name: 'Lisboa' }, 'renameAlbum ["trip","Lisboa"]'],
  [{ kind: ChangeKind.DeleteAlbum, album: TRIP }, 'deleteAlbum ["trip"]'],
]

describe('commitChange', () => {
  it.each(CHANGES)('should send %o to the server once', async (change, call) => {
    const { editor, calls } = recordingEditor()
    const sut = store()

    const outcome = await commitChange(editor, change, sut)

    expect(outcome).toStrictEqual({ status: LoadStatus.Loaded, value: undefined })
    expect(calls).toStrictEqual([call])
    expect(sut.reported).toStrictEqual([])
  })

  it('should show the change before the server answers', async () => {
    let answer = (): void => undefined
    const editor = stubEditor({
      trashPhotos: async () =>
        new Promise<void>((resolve) => {
          answer = resolve
        }),
    })
    const sut = store()

    const committed = commitChange(editor, { kind: ChangeKind.Trash, photoIds: ['a'] }, sut)

    expect(sut.edits().trashed).toStrictEqual(new Set(['a']))
    answer()
    await committed
    expect(sut.history).toHaveLength(1)
    expect(sut.edits().trashed).toStrictEqual(new Set(['a']))
  })

  it('should take the change back when the server refuses it, and log why', async () => {
    const refusal = new PhotoLibraryError(LibraryFailure.KeyRejected, 'HTTP 403')
    const editor = stubEditor({ trashPhotos: async () => Promise.reject(refusal) })
    const sut = store()

    const outcome = await commitChange(editor, { kind: ChangeKind.Trash, photoIds: ['a'] }, sut)

    expect(outcome).toStrictEqual({ status: LoadStatus.Failed, failure: LoadFailure.KeyRejected })
    expect(sut.history.map((edits) => [...edits.trashed])).toStrictEqual([['a'], []])
    expect(sut.reported).toStrictEqual([refusal])
  })

  it('should give the album created the id the server gave it', async () => {
    const created = { ...NEW, id: 'created-1' }
    const editor = stubEditor({ createAlbum: async () => Promise.resolve(created) })
    const sut = store()

    await commitChange(editor, { kind: ChangeKind.CreateAlbum, album: NEW, photoIds: [] }, sut)

    expect(sut.history.map((edits) => edits.created)).toStrictEqual([[NEW], [created]])
  })

  it('should take back an album the server did not create', async () => {
    const editor = stubEditor({ createAlbum: async () => Promise.reject(new TypeError('offline')) })
    const sut = store()

    const outcome = await commitChange(
      editor,
      { kind: ChangeKind.CreateAlbum, album: NEW, photoIds: [] },
      sut,
    )

    expect(outcome).toStrictEqual({ status: LoadStatus.Failed, failure: LoadFailure.Unexpected })
    expect(sut.edits().created).toStrictEqual([])
  })
})
