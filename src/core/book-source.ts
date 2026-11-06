import { loadAlbumPhotos, loadMonthPhotos } from './gallery.ts'
import type { Photo, PhotoLibrary } from './photo-library.ts'
import { type PresentationSource, SourceKind } from './presentation-source.ts'

// What a book shows: an album, or a month of the timeline.
export type BookSource = Extract<
  PresentationSource,
  { readonly kind: typeof SourceKind.Album | typeof SourceKind.Month }
>

// The photos of the book, in the order the album or the month shows them.
export async function loadBookPhotos(
  library: PhotoLibrary,
  source: BookSource,
): Promise<readonly Photo[]> {
  return source.kind === SourceKind.Album
    ? loadAlbumPhotos(library, source.album)
    : loadMonthPhotos(library, source.month)
}

// The same book on every visit: what its seed is kept under.
export function bookKeyOf(source: BookSource): string {
  return source.kind === SourceKind.Album ? `album:${source.album.id}` : `month:${source.month.key}`
}
