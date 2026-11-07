import { useCallback, useMemo } from 'preact/hooks'

import { loadBackdrop } from '../core/backdrop.ts'
import { LoadStatus } from '../core/loading.ts'
import { ImageSize, type PhotoDate, type PhotoLibrary } from '../core/photo-library.ts'
import type { BackdropPhoto } from './Backdrop.tsx'
import { memoryText } from './messages.ts'
import { useLibraryLoad } from './use-load.ts'

const NONE: readonly BackdropPhoto[] = []

// The photos behind the start screen, read once for the whole visit: the previews of the photos of
// this day in past years (or of the nearest day), with how long ago they were taken; else the
// cover of the most recent album. None while they load, when the library has neither, or when the
// read fails (the failure goes to the log, the screen stays plain).
export function useBackdrop(
  library: PhotoLibrary,
  today: () => PhotoDate,
  reportError: (error: unknown) => void,
): readonly BackdropPhoto[] {
  const task = useCallback(
    async () => loadBackdrop(library, today(), reportError),
    [library, today, reportError],
  )
  const { state } = useLibraryLoad(task, reportError)
  return useMemo(() => {
    if (state.status !== LoadStatus.Loaded) {
      return NONE
    }
    return state.value.map((slide) => ({
      url: library.imageUrl(slide.photoId, ImageSize.Preview),
      caption: slide.memory === undefined ? undefined : memoryText(slide.memory),
    }))
  }, [state, library])
}
