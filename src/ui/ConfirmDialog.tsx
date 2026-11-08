import type { JSX } from 'preact'
import { useState } from 'preact/hooks'

import type { KeySource } from '../core/remote-key.ts'
import { DialogButtons } from './DialogButtons.tsx'
import { EDIT_MESSAGES } from './edit-messages.ts'
import type { PanelText } from './messages.ts'
import { Overlay } from './Overlay.tsx'

// Cancel comes first and takes the focus: a hurried OK changes nothing.
const CANCEL = 0

export interface ConfirmDialogProps {
  readonly text: PanelText
  // The button that does it: "Apagar".
  readonly confirmText: string
  readonly keys: KeySource
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

// What is about to be deleted, and how many photos, before anything is: Cancel or the action.
export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element {
  const { text, confirmText, keys, onConfirm, onCancel } = props
  const [focus, setFocus] = useState(CANCEL)
  return (
    <Overlay title={text.title} keysText={EDIT_MESSAGES.confirmKeys}>
      <p class="overlay-hint">{text.hint}</p>
      <DialogButtons
        label={text.title}
        buttons={[
          { key: 'cancel', text: EDIT_MESSAGES.cancel, press: onCancel },
          { key: 'confirm', text: confirmText, isDanger: true, press: onConfirm },
        ]}
        focus={focus}
        keys={keys}
        onMove={setFocus}
        onUp={() => undefined}
        onBack={onCancel}
      />
    </Overlay>
  )
}
