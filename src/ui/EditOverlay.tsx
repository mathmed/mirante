import type { JSX } from 'preact'

import { provisionalAlbum, suggestedName } from '../core/album-name.ts'
import { EditAction } from '../core/edit-actions.ts'
import { type EditStep, IDLE, StepKind } from '../core/edit-flow.ts'
import { ChangeKind } from '../core/library-edits.ts'
import type { Album, Photo, PhotoLibrary } from '../core/photo-library.ts'
import type { KeySource } from '../core/remote-key.ts'
import { AlbumPicker } from './AlbumPicker.tsx'
import { ConfirmDialog } from './ConfirmDialog.tsx'
import {
  actionText,
  deleteAlbumConfirmation,
  EDIT_MESSAGES,
  suggestionText,
  trashConfirmation,
} from './edit-messages.ts'
import { EditMenu } from './EditMenu.tsx'
import { NameDialog } from './NameDialog.tsx'
import type { EditFlow } from './use-edit-flow.ts'
import type { EditingControls } from './use-editing.ts'

export interface EditOverlayProps {
  readonly flow: EditFlow
  // What the menu of the viewer offers.
  readonly menuActions: readonly EditAction[]
  readonly editing: EditingControls
  // The album the photos are in, as the changes left it; undefined for a month.
  readonly album: Album | undefined
  readonly library: PhotoLibrary
  readonly keys: KeySource
  readonly reportError: (error: unknown) => void
  // The change is on its way (the screen already shows it): the selection ends.
  readonly onChanged: () => void
  // The album is gone: its screen leaves.
  readonly onAlbumDeleted: () => void
}

// The step of a change over the screen, which keeps the keys while it shows.
export function EditOverlay(props: EditOverlayProps): JSX.Element | null {
  const { flow, keys } = props
  const { step } = flow
  const close = (): void => {
    flow.setStep(IDLE)
  }
  switch (step.kind) {
    case StepKind.Idle:
      return null
    case StepKind.Menu:
      return (
        <EditMenu
          actions={props.menuActions}
          photos={step.photos}
          keys={keys}
          onRun={flow.run}
          onCancel={close}
        />
      )
    case StepKind.PickAlbum:
      return <PickStep {...props} photos={step.photos} close={close} />
    case StepKind.NameAlbum:
      return <NewAlbumStep {...props} photos={step.photos} close={close} />
    default:
      return <AlbumOrTrashStep {...props} step={step} close={close} />
  }
}

interface StepProps extends EditOverlayProps {
  readonly close: () => void
}

interface PhotosStepProps extends StepProps {
  readonly photos: readonly Photo[]
}

function PickStep(props: PhotosStepProps): JSX.Element {
  const { editing, album, photos, close, onChanged } = props
  return (
    <AlbumPicker
      {...props}
      edits={editing.edits}
      currentAlbumId={album?.id}
      count={photos.length}
      onPick={(picked) => {
        close()
        onChanged()
        const photoIds = photos.map((photo) => photo.id)
        void editing.commit({ kind: ChangeKind.AddToAlbum, album: picked, photoIds })
      }}
      onNew={() => {
        props.flow.setStep({ kind: StepKind.NameAlbum, photos })
      }}
      onCancel={close}
    />
  )
}

// A new album, with the photos to add to it, if any: the name suggested is created in one press.
function NewAlbumStep(props: PhotosStepProps): JSX.Element {
  const { editing, photos, keys, close, onChanged } = props
  return (
    <NameDialog
      title={EDIT_MESSAGES.newAlbumTitle}
      name={suggestionText(suggestedName(photos, editing.today()))}
      confirmText={EDIT_MESSAGES.create}
      isTypingFirst={false}
      keys={keys}
      onConfirm={(name) => {
        close()
        onChanged()
        const created = provisionalAlbum(name, photos, editing.nextSerial())
        const photoIds = photos.map((photo) => photo.id)
        void editing.commit({ kind: ChangeKind.CreateAlbum, album: created, photoIds })
      }}
      onCancel={close}
    />
  )
}

type LastStep = Extract<
  EditStep,
  { readonly kind: 'confirm-delete-album' | 'confirm-trash' | 'rename-album' }
>

interface LastStepProps extends StepProps {
  readonly step: LastStep
}

function AlbumOrTrashStep(props: LastStepProps): JSX.Element {
  const { step, editing, keys, close, onChanged } = props
  switch (step.kind) {
    case StepKind.ConfirmTrash: {
      const photoIds = step.photos.map((photo) => photo.id)
      return (
        <ConfirmDialog
          text={trashConfirmation(photoIds.length)}
          confirmText={actionText(EditAction.Trash)}
          keys={keys}
          onConfirm={() => {
            close()
            onChanged()
            void editing.commit({ kind: ChangeKind.Trash, photoIds })
          }}
          onCancel={close}
        />
      )
    }
    case StepKind.RenameAlbum:
      return <RenameStep {...props} album={step.album} />
    default:
      return <DeleteAlbumStep {...props} album={step.album} />
  }
}

interface AlbumStepProps extends StepProps {
  readonly album: Album
}

// A name left as it was changes nothing.
function RenameStep({ editing, album, keys, close }: AlbumStepProps): JSX.Element {
  return (
    <NameDialog
      title={EDIT_MESSAGES.renameTitle}
      name={album.name}
      confirmText={EDIT_MESSAGES.save}
      isTypingFirst
      keys={keys}
      onConfirm={(name) => {
        close()
        if (name !== album.name) {
          void editing.commit({ kind: ChangeKind.RenameAlbum, album, name })
        }
      }}
      onCancel={close}
    />
  )
}

function DeleteAlbumStep(props: AlbumStepProps): JSX.Element {
  const { editing, album, keys, close } = props
  return (
    <ConfirmDialog
      text={deleteAlbumConfirmation(album.name, album.photoCount)}
      confirmText={actionText(EditAction.DeleteAlbum)}
      keys={keys}
      onConfirm={() => {
        close()
        props.onAlbumDeleted()
        void editing.commit({ kind: ChangeKind.DeleteAlbum, album })
      }}
      onCancel={close}
    />
  )
}
