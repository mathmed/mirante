import { describe, expect, it } from 'vitest'

import {
  blockOf,
  EditAction,
  type EditContext,
  goneFrom,
  gridActions,
  isPhotoAction,
  refusalOf,
  viewerActions,
} from './edit-actions.ts'
import { AccessBlock, type EditAccess } from './library-editor.ts'
import { NO_EDITS } from './library-edits.ts'
import { NO_SELECTION, STARTED_SELECTION } from './selection.ts'

const EVERYTHING: EditAccess = { albums: undefined, trash: undefined }
const ALBUMS_ONLY: EditAccess = { albums: undefined, trash: AccessBlock.TrashOff }
const TRASH_ONLY: EditAccess = { albums: AccessBlock.MissingPermission, trash: undefined }
const PHOTOS = 3
const NOTHING: EditAccess = { albums: AccessBlock.NoKey, trash: AccessBlock.NoKey }

function context(access: EditAccess, albumId?: string, canUndo = false): EditContext {
  return { access, albumId, canUndo }
}

describe('gridActions', () => {
  it('should offer to select, rename and delete the album above its photos', () => {
    expect(gridActions(context(EVERYTHING, 'album-1'), NO_SELECTION, PHOTOS)).toStrictEqual([
      EditAction.Select,
      EditAction.RenameAlbum,
      EditAction.DeleteAlbum,
    ])
  })

  it('should offer the undo first while the photos just deleted can come back', () => {
    expect(gridActions(context(EVERYTHING, undefined, true), NO_SELECTION, PHOTOS)).toStrictEqual([
      EditAction.Undo,
      EditAction.Select,
    ])
  })

  it('should offer no undo when the trash is off', () => {
    expect(gridActions(context(ALBUMS_ONLY, undefined, true), NO_SELECTION, PHOTOS)).toStrictEqual([
      EditAction.Select,
    ])
  })

  it('should offer what can be done to the photos marked, and the end of the selection', () => {
    expect(gridActions(context(EVERYTHING, 'album-1'), STARTED_SELECTION, PHOTOS)).toStrictEqual([
      EditAction.AddToAlbum,
      EditAction.RemoveFromAlbum,
      EditAction.Trash,
      EditAction.EndSelection,
    ])
    expect(gridActions(context(EVERYTHING), STARTED_SELECTION, PHOTOS)).toStrictEqual([
      EditAction.AddToAlbum,
      EditAction.Trash,
      EditAction.EndSelection,
    ])
  })

  it('should leave out what the key cannot do', () => {
    expect(gridActions(context(TRASH_ONLY, 'album-1'), NO_SELECTION, PHOTOS)).toStrictEqual([
      EditAction.Select,
    ])
    expect(gridActions(context(TRASH_ONLY, 'album-1'), STARTED_SELECTION, PHOTOS)).toStrictEqual([
      EditAction.Trash,
      EditAction.EndSelection,
    ])
    expect(gridActions(context(ALBUMS_ONLY), STARTED_SELECTION, PHOTOS)).toStrictEqual([
      EditAction.AddToAlbum,
      EditAction.EndSelection,
    ])
  })

  it('should offer no selection without photos', () => {
    expect(gridActions(context(EVERYTHING, 'album-1', true), NO_SELECTION, 0)).toStrictEqual([
      EditAction.Undo,
      EditAction.RenameAlbum,
      EditAction.DeleteAlbum,
    ])
  })

  it('should offer nothing when nothing can change', () => {
    expect(gridActions(context(NOTHING, 'album-1', true), NO_SELECTION, PHOTOS)).toStrictEqual([])
  })
})

describe('viewerActions', () => {
  it('should offer the undo, then what can be done to the photo on the screen', () => {
    expect(viewerActions(context(EVERYTHING, 'album-1', true))).toStrictEqual([
      EditAction.Undo,
      EditAction.AddToAlbum,
      EditAction.RemoveFromAlbum,
      EditAction.Trash,
    ])
    expect(viewerActions(context(TRASH_ONLY))).toStrictEqual([EditAction.Trash])
    expect(viewerActions(context(NOTHING, undefined, true))).toStrictEqual([])
  })
})

describe('isPhotoAction', () => {
  it('should tell the actions on the photos marked from the others', () => {
    expect(Object.values(EditAction).filter(isPhotoAction)).toStrictEqual([
      EditAction.AddToAlbum,
      EditAction.RemoveFromAlbum,
      EditAction.Trash,
    ])
  })
})

describe('blockOf', () => {
  it('should tell why the photos cannot go to the trash first, then why albums cannot change', () => {
    expect(blockOf(EVERYTHING)).toBeUndefined()
    expect(blockOf(ALBUMS_ONLY)).toBe(AccessBlock.TrashOff)
    expect(blockOf(TRASH_ONLY)).toBe(AccessBlock.MissingPermission)
    expect(blockOf(NOTHING)).toBe(AccessBlock.NoKey)
  })
})

describe('refusalOf', () => {
  it('should tell why nothing can change, or that the check failed', () => {
    expect(refusalOf(NOTHING)).toBe(AccessBlock.NoKey)
    expect(refusalOf(TRASH_ONLY)).toBe(AccessBlock.MissingPermission)
    expect(refusalOf(EVERYTHING)).toBe(AccessBlock.CheckFailed)
  })
})

describe('goneFrom', () => {
  const edits = {
    ...NO_EDITS,
    trashed: new Set(['p-1']),
    removed: new Map([['album-1', new Set(['p-2'])]]),
  }

  it('should let the photos deleted go, and those taken out of the album shown', () => {
    expect(goneFrom(edits, 'album-1')).toStrictEqual(new Set(['p-1', 'p-2']))
  })

  it('should keep the photos taken out of another album', () => {
    expect(goneFrom(edits, 'album-2')).toBe(edits.trashed)
    expect(goneFrom(edits, undefined)).toBe(edits.trashed)
  })
})
