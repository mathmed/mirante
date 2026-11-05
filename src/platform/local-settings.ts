import type { TextStorage } from '../core/settings-storage.ts'

// The settings of the presentation stay on each TV, in the localStorage of the app (its own folder
// in the packaged apps, the origin of the page in a browser).
export const SETTINGS_KEY = 'mirante.presentation'

export interface StorageHost {
  // Read on each call: reading it can throw where the browser forbids storage.
  readonly localStorage: Pick<Storage, 'getItem' | 'setItem'>
}

export function localTextStorage(host: StorageHost, key: string): TextStorage {
  return {
    read: () => host.localStorage.getItem(key) ?? undefined,
    write: (text) => {
      host.localStorage.setItem(key, text)
    },
  }
}
