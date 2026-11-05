import { useLayoutEffect } from 'preact/hooks'

import type { KeyListener, KeySource } from '../core/remote-key.ts'

// The keys of the remote control go to the component that listens while it is on the screen. Only
// one listens at a time: the screen on top, or the viewer over it.
export function useRemoteKeys(keys: KeySource, onKey: KeyListener): void {
  useLayoutEffect(() => keys.subscribe(onKey), [keys, onKey])
}
