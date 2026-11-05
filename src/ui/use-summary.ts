import { useCallback } from 'preact/hooks'

import { type LibrarySummary, loadLibrarySummary } from '../core/library-summary.ts'
import { LoadStatus } from '../core/loading.ts'
import type { PhotoLibrary } from '../core/photo-library.ts'
import { useLibraryLoad } from './use-load.ts'

// What the start screen says of the library, read once for the whole visit. None while it loads,
// for an empty library, or when the read fails (the failure goes to the log, the line stays out).
export function useSummary(
  library: PhotoLibrary,
  reportError: (error: unknown) => void,
): LibrarySummary | undefined {
  const task = useCallback(async () => loadLibrarySummary(library), [library])
  const { state } = useLibraryLoad(task, reportError)
  return state.status === LoadStatus.Loaded ? state.value : undefined
}
