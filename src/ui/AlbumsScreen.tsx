import type { JSX } from 'preact'
import { useCallback, useState } from 'preact/hooks'

import { loadAlbums } from '../core/gallery.ts'
import { ScreenKind } from '../core/navigation.ts'
import { type Album, ImageSize, type PhotoLibrary } from '../core/photo-library.ts'
import { Frame } from './Frame.tsx'
import { Grid } from './Grid.tsx'
import { Loaded } from './Loaded.tsx'
import { Mark } from './Logo.tsx'
import { MESSAGES, photoCountText, shortText } from './messages.ts'
import { Picture } from './Picture.tsx'
import type { ScreenProps } from './screen-props.ts'
import { useLibraryLoad } from './use-load.ts'

const SHAPE = { columns: 4, visibleRows: 2 }
// What fits on one line of a tile.
const NAME_LENGTH = 24

// The albums of the library, each with its cover, its name and how many photos it has.
export function AlbumsScreen(props: ScreenProps): JSX.Element {
  const { library, keys, reportError, back } = props
  const task = useCallback(async () => loadAlbums(library), [library])
  const load = useLibraryLoad(task, reportError)
  return (
    <Frame title={MESSAGES.albums}>
      <Loaded
        load={load}
        emptyText={MESSAGES.noAlbums}
        keys={keys}
        onBack={back}
        render={(albums) => <AlbumGrid albums={albums} {...props} />}
      />
    </Frame>
  )
}

interface AlbumGridProps extends ScreenProps {
  readonly albums: readonly Album[]
}

function AlbumGrid({ albums, library, keys, position, open, back }: AlbumGridProps): JSX.Element {
  const [current, setCurrent] = useState(position)
  return (
    <Grid
      label={MESSAGES.albums}
      variant="albums"
      items={albums}
      shape={SHAPE}
      position={current}
      keys={keys}
      keyOf={(album) => album.id}
      renderTile={(album) => <AlbumTile album={album} library={library} />}
      onMove={setCurrent}
      onOpen={(album, from) => {
        open(from, { kind: ScreenKind.Album, album })
      }}
      onBack={back}
    />
  )
}

interface AlbumTileProps {
  readonly album: Album
  readonly library: PhotoLibrary
}

function AlbumTile({ album, library }: AlbumTileProps): JSX.Element {
  return (
    <>
      <div class="album-cover">
        {album.coverPhotoId === undefined ? (
          <Mark class="album-cover-mark" />
        ) : (
          <Picture
            url={library.imageUrl(album.coverPhotoId, ImageSize.Thumbnail)}
            alt=""
            missingText={MESSAGES.photoUnavailable}
          />
        )}
      </div>
      <span class="tile-title">{shortText(album.name, NAME_LENGTH)}</span>
      <span class="tile-detail">{photoCountText(album.photoCount)}</span>
    </>
  )
}
