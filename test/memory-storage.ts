import type { TextStorage } from '../src/core/settings-storage.ts'

// The storage of a TV for the tests: what it keeps, in memory.
export interface MemoryStorage {
  readonly storage: TextStorage
  readonly written: string[]
}

export function memoryStorage(stored?: string): MemoryStorage {
  const written: string[] = []
  return {
    written,
    storage: {
      read: () => written[written.length - 1] ?? stored,
      write: (text) => {
        written.push(text)
      },
    },
  }
}
