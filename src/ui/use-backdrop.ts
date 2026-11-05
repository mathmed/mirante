import { useCallback } from 'preact/hooks'

import { backdropPhotoId, loadAlbums } from '../core/gallery.ts'
import { LoadStatus } from '../core/loading.ts'
import { ImageSize, type PhotoLibrary } from '../core/photo-library.ts'
import { useLibraryLoad } from './use-load.ts'

// The address of the photo behind the start screen, read once for the whole visit: the preview of
// the cover of the most recent album. None while it loads, when the library has no cover, or when
// the read fails (the failure goes to the log, the screen stays plain).
export function useBackdrop(
  library: PhotoLibrary,
  reportError: (error: unknown) => void,
): string | undefined {
  const task = useCallback(async () => loadAlbums(library), [library])
  const { state } = useLibraryLoad(task, reportError)
  if (state.status !== LoadStatus.Loaded) {
    return undefined
  }
  const photoId = backdropPhotoId(state.value)
  return photoId === undefined ? undefined : library.imageUrl(photoId, ImageSize.Preview)
}
