import { EditAction } from './edit-actions.ts'
import type { Album, Photo } from './photo-library.ts'

// Where a change stands before it is made: nothing asked, the menu of the viewer open, an album to
// choose, a name to type, a deletion to confirm.
export const StepKind = {
  Idle: 'idle',
  Menu: 'menu',
  PickAlbum: 'pick-album',
  NameAlbum: 'name-album',
  RenameAlbum: 'rename-album',
  ConfirmTrash: 'confirm-trash',
  ConfirmDeleteAlbum: 'confirm-delete-album',
} as const

export type StepKind = (typeof StepKind)[keyof typeof StepKind]

interface PhotosStep<K extends StepKind> {
  readonly kind: K
  // The photos the change acts on: those marked in a grid, or the one on the screen.
  readonly photos: readonly Photo[]
}

interface AlbumStep<K extends StepKind> {
  readonly kind: K
  // The album renamed or deleted, as the changes left it.
  readonly album: Album
}

export type EditStep =
  | { readonly kind: typeof StepKind.Idle }
  | AlbumStep<typeof StepKind.RenameAlbum>
  | AlbumStep<typeof StepKind.ConfirmDeleteAlbum>
  | PhotosStep<typeof StepKind.Menu>
  | PhotosStep<typeof StepKind.PickAlbum>
  | PhotosStep<typeof StepKind.NameAlbum>
  | PhotosStep<typeof StepKind.ConfirmTrash>

export const IDLE: EditStep = { kind: StepKind.Idle }

// What an action acts on: the photos marked, or the one on the screen, in an album or a month.
export interface EditTarget {
  readonly photos: readonly Photo[]
  readonly album: Album | undefined
}

// What an action asks before it changes anything; undefined for those that act at once (taking
// photos out of an album, which deletes nothing, the undo) or change no photo (the selection), and
// for an action on an album without one.
export function stepOf(action: EditAction, { photos, album }: EditTarget): EditStep | undefined {
  switch (action) {
    case EditAction.AddToAlbum:
      return { kind: StepKind.PickAlbum, photos }
    case EditAction.Trash:
      return { kind: StepKind.ConfirmTrash, photos }
    default:
      return album === undefined ? undefined : albumStepOf(action, album)
  }
}

function albumStepOf(action: EditAction, album: Album): EditStep | undefined {
  switch (action) {
    case EditAction.RenameAlbum:
      return { kind: StepKind.RenameAlbum, album }
    case EditAction.DeleteAlbum:
      return { kind: StepKind.ConfirmDeleteAlbum, album }
    default:
      return undefined
  }
}
