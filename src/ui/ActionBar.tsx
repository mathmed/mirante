import type { JSX } from 'preact'

import { EditAction } from '../core/edit-actions.ts'
import { Axis } from '../core/line-focus.ts'
import { type KeySource, RemoteKey } from '../core/remote-key.ts'
import { ChoiceLine } from './ChoiceLine.tsx'
import { actionText, EDIT_MESSAGES } from './edit-messages.ts'

export interface ActionBarProps {
  readonly actions: readonly EditAction[]
  // The action in focus, or undefined while the focus is on the grid below.
  readonly focus: number | undefined
  // Beside the actions: what the selection holds, or why some actions are off.
  readonly note: string | undefined
  readonly keys: KeySource
  readonly onMove: (index: number) => void
  readonly onRun: (action: EditAction) => void
  // Down: the focus goes back to the grid.
  readonly onLeave: () => void
  readonly onBack: () => void
}

// The actions above a grid, side by side: Up on its first row reaches them.
export function ActionBar(props: ActionBarProps): JSX.Element {
  const { actions, focus, note, keys, onMove, onRun, onLeave, onBack } = props
  return (
    <div class="action-bar">
      <ChoiceLine
        label={EDIT_MESSAGES.menuTitle}
        choices={actions.map((action) => ({
          key: action,
          text: actionText(action),
          isDanger: action === EditAction.Trash || action === EditAction.DeleteAlbum,
        }))}
        axis={Axis.Row}
        visible={actions.length}
        focus={focus}
        keys={keys}
        onMove={onMove}
        onChoose={(index) => {
          actions.slice(index, index + 1).forEach(onRun)
        }}
        onLeave={(key) => {
          if (key === RemoteKey.Down) {
            onLeave()
          }
        }}
        onBack={onBack}
      />
      {note !== undefined && <p class="action-note">{note}</p>}
    </div>
  )
}
