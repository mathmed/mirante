import type { JSX } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import { albumNameOf, MAX_ALBUM_NAME_LENGTH } from '../core/album-name.ts'
import { type KeySource, RemoteKey } from '../core/remote-key.ts'
import { DialogButtons } from './DialogButtons.tsx'
import { EDIT_MESSAGES } from './edit-messages.ts'
import { KeyListener } from './KeyListener.tsx'
import { Overlay } from './Overlay.tsx'

const CONFIRM = 0
// Where the focus is: in the field, or on a button.
const FIELD = -1

export interface NameDialogProps {
  readonly title: string
  // What the field holds when it opens: a suggested name, or the album's.
  readonly name: string
  readonly confirmText: string
  // Whether the field takes the focus at once (and the TV opens its keyboard): to rename. A new
  // album opens on its button instead, to be created with the name suggested in one press.
  readonly isTypingFirst: boolean
  readonly keys: KeySource
  readonly onConfirm: (name: string) => void
  readonly onCancel: () => void
}

// The name of an album, typed with the keyboard of the TV (or of a computer). Up goes to the field,
// Down to the buttons; Enter in the field confirms, Back in it goes to the buttons.
export function NameDialog(props: NameDialogProps): JSX.Element {
  const { title, confirmText, keys, onCancel } = props
  const [focus, setFocus] = useState(props.isTypingFirst ? FIELD : CONFIRM)
  const [typed, setTyped] = useState(props.name)
  const { isNameMissing, confirm } = useConfirm(typed, props.onConfirm)
  return (
    <Overlay title={title} keysText={EDIT_MESSAGES.nameKeys}>
      <NameField typed={typed} onType={setTyped} isFocused={focus === FIELD} />
      {isNameMissing && <p class="overlay-hint is-error">{EDIT_MESSAGES.nameRequired}</p>}
      {focus === FIELD && <FieldKeys {...{ keys, confirm, setFocus }} />}
      <DialogButtons
        label={title}
        buttons={[
          { key: 'confirm', text: confirmText, press: confirm },
          { key: 'cancel', text: EDIT_MESSAGES.cancel, press: onCancel },
        ]}
        focus={focus === FIELD ? undefined : focus}
        keys={keys}
        onMove={setFocus}
        onUp={() => {
          setFocus(FIELD)
        }}
        onBack={onCancel}
      />
    </Overlay>
  )
}

interface Confirming {
  readonly isNameMissing: boolean
  readonly confirm: () => void
}

// The name typed, without the blanks around it; a name of blanks alone is refused, and said so.
function useConfirm(typed: string, onConfirm: (name: string) => void): Confirming {
  const [isNameMissing, setIsNameMissing] = useState(false)
  const confirm = useCallback(() => {
    const name = albumNameOf(typed)
    setIsNameMissing(name === undefined)
    if (name !== undefined) {
      onConfirm(name)
    }
  }, [typed, onConfirm])
  return { isNameMissing, confirm }
}

interface NameFieldProps {
  readonly typed: string
  readonly onType: (typed: string) => void
  readonly isFocused: boolean
}

// Focused, the field opens the keyboard of the TV; left, it closes it.
function NameField({ typed, onType, isFocused }: NameFieldProps): JSX.Element {
  const fieldRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const field = fieldRef.current
    if (isFocused) {
      field?.focus({ preventScroll: true })
      field?.select()
    } else {
      field?.blur()
    }
  }, [isFocused])
  return (
    <input
      ref={fieldRef}
      class="name-field"
      type="text"
      value={typed}
      onInput={(event) => {
        onType(event.currentTarget.value)
      }}
      maxLength={MAX_ALBUM_NAME_LENGTH}
      aria-label={EDIT_MESSAGES.nameLabel}
      tabIndex={-1}
    />
  )
}

interface FieldKeysProps {
  readonly keys: KeySource
  readonly confirm: () => void
  readonly setFocus: (focus: number) => void
}

function FieldKeys({ keys, confirm, setFocus }: FieldKeysProps): JSX.Element {
  const onKey = useCallback(
    (key: RemoteKey) => {
      if (key === RemoteKey.Enter) {
        confirm()
      } else if (key === RemoteKey.Down || key === RemoteKey.Back) {
        setFocus(CONFIRM)
      }
    },
    [confirm, setFocus],
  )
  return <KeyListener keys={keys} onKey={onKey} />
}
