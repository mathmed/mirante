import type { JSX } from 'preact'
import { useState } from 'preact/hooks'

import { EditAction } from '../core/edit-actions.ts'
import { Axis } from '../core/line-focus.ts'
import type { Photo } from '../core/photo-library.ts'
import type { KeySource } from '../core/remote-key.ts'
import { ChoiceLine } from './ChoiceLine.tsx'
import { actionText, EDIT_MESSAGES } from './edit-messages.ts'
import { Overlay } from './Overlay.tsx'

export interface EditMenuProps {
  readonly actions: readonly EditAction[]
  // The photo on the screen of the viewer.
  readonly photos: readonly Photo[]
  readonly keys: KeySource
  readonly onRun: (action: EditAction, photos: readonly Photo[]) => void
  readonly onCancel: () => void
}

// What can be done to the photo on the screen, one above the other, over the viewer.
export function EditMenu({ actions, photos, keys, onRun, onCancel }: EditMenuProps): JSX.Element {
  const [focus, setFocus] = useState(0)
  return (
    <Overlay title={EDIT_MESSAGES.menuTitle} keysText={EDIT_MESSAGES.menuKeys}>
      <ChoiceLine
        label={EDIT_MESSAGES.menuTitle}
        choices={actions.map((action) => ({
          key: action,
          text: actionText(action),
          isDanger: action === EditAction.Trash,
        }))}
        axis={Axis.Column}
        visible={actions.length}
        focus={focus}
        keys={keys}
        onMove={setFocus}
        onChoose={(index) => {
          actions.slice(index, index + 1).forEach((action) => {
            onRun(action, photos)
          })
        }}
        onLeave={() => undefined}
        onBack={onCancel}
      />
    </Overlay>
  )
}
