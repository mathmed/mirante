import type { Photo } from './photo-library.ts'

// The photos marked in a grid, to act on them at once: Enter marks or unmarks the photo in focus
// while the grid selects. Ending the selection forgets the marks.
export interface Selection {
  readonly isActive: boolean
  readonly ids: ReadonlySet<string>
}

export const NO_SELECTION: Selection = { isActive: false, ids: new Set() }

export const STARTED_SELECTION: Selection = { isActive: true, ids: new Set() }

export function toggleSelected(selection: Selection, photoId: string): Selection {
  const ids = new Set(selection.ids)
  if (!ids.delete(photoId)) {
    ids.add(photoId)
  }
  return { isActive: true, ids }
}

// The photos marked that the grid still shows, in its order: a photo deleted or taken out of the
// album meanwhile is left out.
export function selectedPhotos(selection: Selection, photos: readonly Photo[]): readonly Photo[] {
  return photos.filter((photo) => selection.ids.has(photo.id))
}

export function isSelected(selection: Selection, photoId: string): boolean {
  return selection.ids.has(photoId)
}
