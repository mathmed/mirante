// The captions of the photos (their description in Immich) come one photo at a time: the viewer
// asks for the photo on the screen and the next one only, and keeps the last few here, so that
// going back and forth never asks twice. A read in flight is shared.
export const CAPTION_CACHE_SIZE = 6

export interface CaptionCache {
  // Never fails: a caption that cannot be read is no caption, and the error goes to the log.
  readonly captionOf: (photoId: string) => Promise<string | undefined>
}

export function createCaptionCache(
  read: (photoId: string) => Promise<string | undefined>,
  reportError: (error: unknown) => void,
): CaptionCache {
  const entries = new Map<string, Promise<string | undefined>>()
  const forget = (photoId: string, caption: Promise<string | undefined>): void => {
    if (entries.get(photoId) === caption) {
      entries.delete(photoId)
    }
  }
  return {
    captionOf: async (photoId) => {
      const caption =
        entries.get(photoId) ??
        read(photoId).catch((error: unknown) => {
          forget(photoId, caption)
          reportError(error)
          return undefined
        })
      remember(entries, photoId, caption)
      return caption
    },
  }
}

// The most recent last; the oldest goes once the cache is full.
function remember(
  entries: Map<string, Promise<string | undefined>>,
  photoId: string,
  caption: Promise<string | undefined>,
): void {
  entries.delete(photoId)
  entries.set(photoId, caption)
  for (const oldest of entries.keys()) {
    if (entries.size <= CAPTION_CACHE_SIZE) {
      return
    }
    entries.delete(oldest)
  }
}
