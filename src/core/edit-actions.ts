import { AccessBlock, type EditAccess } from './library-editor.ts'
import type { LibraryEdits } from './library-edits.ts'
import type { Selection } from './selection.ts'

// What can be done to the photos of a grid, of the viewer, or to the album they are in: the
// buttons of the bar above a grid and the items of the menu of the viewer, in their order.
export const EditAction = {
  // The photos sent to the trash a moment ago come back.
  Undo: 'undo',
  Select: 'select',
  AddToAlbum: 'add-to-album',
  RemoveFromAlbum: 'remove-from-album',
  Trash: 'trash',
  EndSelection: 'end-selection',
  RenameAlbum: 'rename-album',
  DeleteAlbum: 'delete-album',
} as const

export type EditAction = (typeof EditAction)[keyof typeof EditAction]

// Where the actions are offered.
export interface EditContext {
  readonly access: EditAccess
  // The album the photos are in, when they are an album's and it can change (the server created
  // it); undefined for a month.
  readonly albumId: string | undefined
  // Whether photos went to the trash a moment ago.
  readonly canUndo: boolean
}

const PHOTO_ACTIONS: ReadonlySet<EditAction> = new Set([
  EditAction.AddToAlbum,
  EditAction.RemoveFromAlbum,
  EditAction.Trash,
])

// Whether the action acts on photos, which must be marked first.
export function isPhotoAction(action: EditAction): boolean {
  return PHOTO_ACTIONS.has(action)
}

// Above a grid: to start a selection (when it has photos), and to rename or delete its album;
// while it selects, what can be done to the photos marked, and the end of it.
export function gridActions(
  context: EditContext,
  selection: Selection,
  photoCount: number,
): readonly EditAction[] {
  if (selection.isActive) {
    return [...photoActions(context), EditAction.EndSelection]
  }
  const canSelect = photoCount > 0 && photoActions(context).length > 0
  return [
    ...undoActions(context),
    ...(canSelect ? [EditAction.Select] : []),
    ...albumActions(context),
  ]
}

function albumActions({ access, albumId }: EditContext): readonly EditAction[] {
  return albumId !== undefined && access.albums === undefined
    ? [EditAction.RenameAlbum, EditAction.DeleteAlbum]
    : []
}

// Over the viewer: what can be done to the photo on the screen.
export function viewerActions(context: EditContext): readonly EditAction[] {
  return [...undoActions(context), ...photoActions(context)]
}

function undoActions({ access, canUndo }: EditContext): readonly EditAction[] {
  return canUndo && access.trash === undefined ? [EditAction.Undo] : []
}

function photoActions({ access, albumId }: EditContext): readonly EditAction[] {
  const albums =
    access.albums === undefined
      ? [EditAction.AddToAlbum, ...(albumId === undefined ? [] : [EditAction.RemoveFromAlbum])]
      : []
  return [...albums, ...(access.trash === undefined ? [EditAction.Trash] : [])]
}

// Why some changes are off, to say beside the actions that are on: the photos, whose trash says
// more, then the albums. Undefined when everything is on.
export function blockOf(access: EditAccess): AccessBlock | undefined {
  return access.trash ?? access.albums
}

// Why nothing can change where no action is offered: always a block there, the failed check if
// not.
export function refusalOf(access: EditAccess): AccessBlock {
  return blockOf(access) ?? AccessBlock.CheckFailed
}

// The photos a list no longer shows: those sent to the trash and, in an album, those taken out of
// it. The viewer lets them go.
export function goneFrom(edits: LibraryEdits, albumId: string | undefined): ReadonlySet<string> {
  const removed = albumId === undefined ? undefined : edits.removed.get(albumId)
  return removed === undefined ? edits.trashed : new Set([...edits.trashed, ...removed])
}
