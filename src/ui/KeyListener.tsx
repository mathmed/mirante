import type { KeySource, KeyListener as Listener } from '../core/remote-key.ts'
import { useRemoteKeys } from './use-remote-keys.ts'

export interface KeyListenerProps {
  readonly keys: KeySource
  readonly onKey: Listener
}

// Listens to the remote control while it is rendered: a component that hands the keys over to
// another one (the viewer to its settings) stops rendering it.
export function KeyListener({ keys, onKey }: KeyListenerProps): null {
  useRemoteKeys(keys, onKey)
  return null
}
