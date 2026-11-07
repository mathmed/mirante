import type { JSX } from 'preact'
import { useCallback, useEffect, useRef } from 'preact/hooks'

import { type Axis, leavesLine, lineWindow, moveInLine } from '../core/line-focus.ts'
import { type KeySource, RemoteKey } from '../core/remote-key.ts'
import { useRemoteKeys } from './use-remote-keys.ts'

export interface Choice {
  readonly key: string
  readonly text: string
  // A second line, smaller: how many photos an album has, say.
  readonly detail?: string
  // Drawn in the color of what cannot be undone.
  readonly isDanger?: boolean
}

export interface ChoiceLineProps {
  readonly label: string
  readonly choices: readonly Choice[]
  readonly axis: Axis
  // The choices on the screen at once; the rest of a long list is left out.
  readonly visible: number
  // The choice in focus, or undefined while the focus is elsewhere (the line does not listen).
  readonly focus: number | undefined
  readonly keys: KeySource
  readonly onMove: (index: number) => void
  readonly onChoose: (index: number) => void
  // An arrow across the line, or past one of its ends.
  readonly onLeave: (key: RemoteKey) => void
  readonly onBack: () => void
}

// Buttons side by side, or one above the other, that the arrows walk through: a bar of actions, a
// menu, the buttons of a dialog.
export function ChoiceLine(props: ChoiceLineProps): JSX.Element {
  const { label, choices, axis, visible, focus } = props
  const { start, end } = lineWindow(focus ?? 0, choices.length, visible)
  return (
    <div class={`choices choices-${axis}`} role="toolbar" aria-label={label}>
      {focus !== undefined && <ChoiceKeys {...props} focus={focus} />}
      {choices.slice(start, end).map((choice, offset) => (
        <ChoiceButton key={choice.key} choice={choice} isFocused={start + offset === focus} />
      ))}
    </div>
  )
}

interface ChoiceKeysProps extends ChoiceLineProps {
  readonly focus: number
}

function ChoiceKeys(props: ChoiceKeysProps): null {
  const { choices, axis, focus, keys, onMove, onChoose, onLeave, onBack } = props
  const onKey = useCallback(
    (key: RemoteKey) => {
      const line = { count: choices.length, axis }
      if (key === RemoteKey.Back) {
        onBack()
      } else if (key === RemoteKey.Enter) {
        onChoose(focus)
      } else if (leavesLine(focus, key, line)) {
        onLeave(key)
      } else {
        onMove(moveInLine(focus, key, line))
      }
    },
    [choices.length, axis, focus, onMove, onChoose, onLeave, onBack],
  )
  useRemoteKeys(keys, onKey)
  return null
}

interface ChoiceButtonProps {
  readonly choice: Choice
  readonly isFocused: boolean
}

function ChoiceButton({ choice, isFocused }: ChoiceButtonProps): JSX.Element {
  const buttonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (isFocused) {
      buttonRef.current?.focus({ preventScroll: true })
    }
  }, [isFocused])
  return (
    <button
      ref={buttonRef}
      class={choice.isDanger === true ? 'choice is-danger' : 'choice'}
      type="button"
      tabIndex={-1}
    >
      <span class="choice-text">{choice.text}</span>
      {choice.detail !== undefined && <span class="choice-detail">{choice.detail}</span>}
    </button>
  )
}
