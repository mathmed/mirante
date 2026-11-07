import { useCallback, useState } from 'preact/hooks'

import { EditAction } from '../core/edit-actions.ts'
import { type EditStep, IDLE, stepOf } from '../core/edit-flow.ts'
import { ChangeKind } from '../core/library-edits.ts'
import type { Album, Photo } from '../core/photo-library.ts'
import type { EditingControls } from './use-editing.ts'

export interface EditFlow {
  readonly step: EditStep
  readonly setStep: (step: EditStep) => void
  // An action of the bar or of the menu, on the photos marked or the one on the screen.
  readonly run: (action: EditAction, photos: readonly Photo[]) => void
}

export interface EditFlowOptions {
  readonly editing: EditingControls
  // The album the photos are in, as the changes left it; undefined for a month.
  readonly album: Album | undefined
  // The change is on its way (the screen already shows it).
  readonly onChanged: () => void
}

// The step a change is at, on a screen: an action asks what it needs, or acts at once.
export function useEditFlow({ editing, album, onChanged }: EditFlowOptions): EditFlow {
  const [step, setStep] = useState(IDLE)
  const run = useCallback(
    (action: EditAction, photos: readonly Photo[]) => {
      const next = stepOf(action, { photos, album })
      setStep(next ?? IDLE)
      if (action === EditAction.Undo) {
        editing.undo()
      } else if (action === EditAction.RemoveFromAlbum && album !== undefined) {
        onChanged()
        const photoIds = photos.map((photo) => photo.id)
        void editing.commit({ kind: ChangeKind.RemoveFromAlbum, album, photoIds })
      }
    },
    [editing, album, onChanged],
  )
  return { step, setStep, run }
}
