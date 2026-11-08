import type { JSX } from 'preact'

import { Axis } from '../core/line-focus.ts'
import { type KeySource, RemoteKey } from '../core/remote-key.ts'
import { type Choice, ChoiceLine } from './ChoiceLine.tsx'

interface DialogButton extends Choice {
  readonly press: () => void
}

export interface DialogButtonsProps {
  readonly label: string
  readonly buttons: readonly DialogButton[]
  // The button in focus, or undefined while the focus is elsewhere in the dialog.
  readonly focus: number | undefined
  readonly keys: KeySource
  readonly onMove: (index: number) => void
  // Up, to what is above the buttons.
  readonly onUp: () => void
  readonly onBack: () => void
}

// The buttons of a dialog, side by side: Enter presses the one in focus.
export function DialogButtons(props: DialogButtonsProps): JSX.Element {
  const { buttons, onUp } = props
  return (
    <ChoiceLine
      {...props}
      choices={buttons}
      axis={Axis.Row}
      visible={buttons.length}
      onChoose={(index) => {
        buttons.slice(index, index + 1).forEach((button) => {
          button.press()
        })
      }}
      onLeave={(key) => {
        if (key === RemoteKey.Up) {
          onUp()
        }
      }}
    />
  )
}
