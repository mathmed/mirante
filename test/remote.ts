import { act } from '@testing-library/preact'

import type { KeyListener, KeySource, RemoteKey } from '../src/core/remote-key.ts'

// A remote control for the tests of the components: each press reaches the listening component and
// lets it render. The key codes of the TVs are tested with src/platform/remote-control.ts.
export interface FakeRemote {
  readonly keys: KeySource
  readonly press: (...keys: readonly RemoteKey[]) => void
  // Keys that arrive before the screen renders again, like a double press.
  readonly pressAtOnce: (...keys: readonly RemoteKey[]) => void
}

export function fakeRemote(): FakeRemote {
  const listeners = new Set<KeyListener>()
  const dispatch = (key: RemoteKey): void => {
    for (const listener of [...listeners]) {
      listener(key)
    }
  }
  return {
    keys: {
      subscribe: (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    },
    press: (...keys) => {
      for (const key of keys) {
        void act(() => {
          dispatch(key)
        })
      }
    },
    pressAtOnce: (...keys) => {
      void act(() => {
        keys.forEach(dispatch)
      })
    },
  }
}
