import type { JSX } from 'preact'
import { useCallback, useEffect, useRef } from 'preact/hooks'

import type { LoadFailure } from '../core/loading.ts'
import { type KeySource, RemoteKey } from '../core/remote-key.ts'
import type { StartupFailure } from '../core/startup.ts'
import { failureText, MESSAGES } from './messages.ts'
import { useRemoteKeys } from './use-remote-keys.ts'

// What a screen shows while it waits, when it fails and when there is nothing to show. The button
// takes the focus by itself: Enter presses it, Back leaves the screen.

export interface WaitingProps {
  readonly text: string
  readonly keys: KeySource
  // Absent where there is no screen to go back to.
  readonly onBack?: () => void
}

export function Waiting({ text, keys, onBack }: WaitingProps): JSX.Element {
  const onKey = useCallback(
    (key: RemoteKey) => {
      if (key === RemoteKey.Back) {
        onBack?.()
      }
    },
    [onBack],
  )
  useRemoteKeys(keys, onKey)
  return (
    <p class="status" role="status">
      {text}
    </p>
  )
}

export interface FailureProps {
  readonly failure: LoadFailure | StartupFailure
  readonly keys: KeySource
  readonly onRetry: () => void
  // Absent where there is no screen to go back to.
  readonly onBack?: () => void
}

export function Failure({ failure, keys, onRetry, onBack }: FailureProps): JSX.Element {
  const text = failureText(failure)
  return (
    <section class="panel panel-error" role="alert">
      <h2>{text.title}</h2>
      <p>{text.hint}</p>
      <ActionButton text={MESSAGES.retry} keys={keys} onPress={onRetry} onBack={onBack} />
    </section>
  )
}

export interface EmptyProps {
  readonly text: string
  readonly keys: KeySource
  readonly onBack: () => void
}

export function Empty({ text, keys, onBack }: EmptyProps): JSX.Element {
  return (
    <section class="panel" role="status">
      <h2>{text}</h2>
      <ActionButton text={MESSAGES.back} keys={keys} onPress={onBack} onBack={onBack} />
    </section>
  )
}

interface ActionButtonProps {
  readonly text: string
  readonly keys: KeySource
  readonly onPress: () => void
  readonly onBack: (() => void) | undefined
}

function ActionButton({ text, keys, onPress, onBack }: ActionButtonProps): JSX.Element {
  const buttonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    buttonRef.current?.focus()
  }, [])
  const onKey = useCallback(
    (key: RemoteKey) => {
      if (key === RemoteKey.Enter) {
        onPress()
      } else if (key === RemoteKey.Back) {
        onBack?.()
      }
    },
    [onPress, onBack],
  )
  useRemoteKeys(keys, onKey)
  return (
    <button ref={buttonRef} class="action" type="button" tabIndex={-1}>
      {text}
    </button>
  )
}
