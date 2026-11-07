import { describe, expect, it } from 'vitest'

import { photos } from '../../test/library-stub.ts'
import { EditAction } from './edit-actions.ts'
import { StepKind, stepOf } from './edit-flow.ts'
import { type Album, PhotoOrder } from './photo-library.ts'

const PHOTOS = photos('p', 2)
const ALBUM: Album = { id: 'a-1', name: 'Lisboa', photoCount: 2, order: PhotoOrder.NewestFirst }
const IN_ALBUM = { photos: PHOTOS, album: ALBUM }
const IN_MONTH = { photos: PHOTOS, album: undefined }

describe('stepOf', () => {
  it('should ask for an album before adding photos to one', () => {
    expect(stepOf(EditAction.AddToAlbum, IN_MONTH)).toStrictEqual({
      kind: StepKind.PickAlbum,
      photos: PHOTOS,
    })
  })

  it('should ask to confirm before sending photos to the trash, or deleting an album', () => {
    expect(stepOf(EditAction.Trash, IN_ALBUM)).toStrictEqual({
      kind: StepKind.ConfirmTrash,
      photos: PHOTOS,
    })
    expect(stepOf(EditAction.DeleteAlbum, IN_ALBUM)).toStrictEqual({
      kind: StepKind.ConfirmDeleteAlbum,
      album: ALBUM,
    })
  })

  it('should ask for the new name of an album', () => {
    expect(stepOf(EditAction.RenameAlbum, IN_ALBUM)).toStrictEqual({
      kind: StepKind.RenameAlbum,
      album: ALBUM,
    })
  })

  it('should ask nothing of an action on an album without one', () => {
    expect(stepOf(EditAction.RenameAlbum, IN_MONTH)).toBeUndefined()
    expect(stepOf(EditAction.DeleteAlbum, IN_MONTH)).toBeUndefined()
  })

  it.each([
    EditAction.RemoveFromAlbum,
    EditAction.Undo,
    EditAction.Select,
    EditAction.EndSelection,
  ])('should ask nothing before %s', (action) => {
    expect(stepOf(action, IN_ALBUM)).toBeUndefined()
  })
})
