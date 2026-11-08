import { isProvisional } from './album-name.ts'
import { type LibraryEdits, visibleAlbums } from './library-edits.ts'
import type { Album } from './photo-library.ts'

// The albums photos can be added to, under "Novo álbum": every album as the changes left it, but
// the one the photos are in and those the server has not created yet.
export function pickableAlbums(
  albums: readonly Album[],
  edits: LibraryEdits,
  currentAlbumId: string | undefined,
): readonly Album[] {
  return visibleAlbums(albums, edits).filter(
    (album) => album.id !== currentAlbumId && !isProvisional(album),
  )
}
