import { backdropPhotoId, loadAlbums } from './gallery.ts'
import { loadMemories, type Memory } from './on-this-day.ts'
import type { PhotoDate, PhotoLibrary } from './photo-library.ts'

// A photo behind the start screen, in its turn.
export interface BackdropSlide {
  readonly photoId: string
  // For a photo of this day in a past year; none for the cover of an album.
  readonly memory?: Memory
}

// The photos of this day in past years (or of the nearest day); without any, the cover of the most
// recent album; without one, none. A failed search of the past years goes to the log and gives way
// to the cover; a failed read of the albums fails the whole.
export async function loadBackdrop(
  library: PhotoLibrary,
  today: PhotoDate,
  reportError: (error: unknown) => void,
): Promise<readonly BackdropSlide[]> {
  const memories = await memoriesOrNone(library, today, reportError)
  if (memories.length > 0) {
    return memories.map((memory) => ({ photoId: memory.photoId, memory }))
  }
  const cover = backdropPhotoId(await loadAlbums(library))
  return cover === undefined ? [] : [{ photoId: cover }]
}

async function memoriesOrNone(
  library: PhotoLibrary,
  today: PhotoDate,
  reportError: (error: unknown) => void,
): Promise<readonly Memory[]> {
  try {
    return await loadMemories(library, today)
  } catch (error) {
    reportError(error)
    return []
  }
}
