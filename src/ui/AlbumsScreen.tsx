import type { JSX } from 'preact'
import { useCallback, useMemo, useState } from 'preact/hooks'

import { isProvisional, provisionalAlbum, suggestedName } from '../core/album-name.ts'
import { loadAlbums } from '../core/gallery.ts'
import type { GridPosition } from '../core/grid.ts'
import { ChangeKind, type LibraryEdits, visibleAlbums } from '../core/library-edits.ts'
import { type LoadState, LoadStatus } from '../core/loading.ts'
import { albumScreen, Intent } from '../core/navigation.ts'
import { type Album, ImageSize, type PhotoLibrary } from '../core/photo-library.ts'
import { EDIT_MESSAGES, suggestionText } from './edit-messages.ts'
import { Frame } from './Frame.tsx'
import { Grid } from './Grid.tsx'
import { Loaded } from './Loaded.tsx'
import { Mark } from './Logo.tsx'
import { albumsTitle, MESSAGES, photoCountText, shortText } from './messages.ts'
import { NameDialog } from './NameDialog.tsx'
import { Picture } from './Picture.tsx'
import type { ScreenProps } from './screen-props.ts'
import type { EditingControls } from './use-editing.ts'
import { useLibraryLoad } from './use-load.ts'

const SHAPE = { columns: 4, visibleRows: 2 }
// What fits on one line of a tile.
const NAME_LENGTH = 24
// The first tile creates an album, when albums can change and the screen browses them.
const NEW_ALBUM_TILE = { kind: 'new-album' } as const
type Tile = Album | typeof NEW_ALBUM_TILE
// The album created takes the focus: it comes first, after the tile that created it.
const CREATED_FOCUS = 1

export interface AlbumsScreenProps extends ScreenProps {
  // To browse the albums, or to choose one to present.
  readonly intent: Intent
}

// The albums of the library, each with its cover, its name and how many photos it has, as the
// changes of the visit left them.
export function AlbumsScreen(props: AlbumsScreenProps): JSX.Element {
  const { library, keys, reportError, back, editing, intent } = props
  const task = useCallback(async () => loadAlbums(library), [library])
  const load = useLibraryLoad(task, reportError)
  const canCreate = intent === Intent.Browse && editing.access.albums === undefined
  const state = useMemo(
    () => tilesOf(load.state, editing.edits, canCreate),
    [load.state, editing.edits, canCreate],
  )
  return (
    <Frame title={albumsTitle(intent)}>
      <Loaded
        load={{ state, retry: load.retry }}
        emptyText={MESSAGES.noAlbums}
        keys={keys}
        onBack={back}
        render={(tiles) => <AlbumGrid tiles={tiles} {...props} />}
      />
    </Frame>
  )
}

function tilesOf(
  state: LoadState<readonly Album[]>,
  edits: LibraryEdits,
  canCreate: boolean,
): LoadState<readonly Tile[]> {
  if (state.status !== LoadStatus.Loaded) {
    return state
  }
  const albums = visibleAlbums(state.value, edits)
  return { ...state, value: canCreate ? [NEW_ALBUM_TILE, ...albums] : albums }
}

interface AlbumGridProps extends AlbumsScreenProps {
  readonly tiles: readonly Tile[]
}

function AlbumGrid(props: AlbumGridProps): JSX.Element {
  const { keys, position, editing } = props
  const [current, setCurrent] = useState(position)
  const [isNaming, setIsNaming] = useState(false)
  const startNaming = (): void => {
    setIsNaming(true)
  }
  const close = (isCreated: boolean): void => {
    setIsNaming(false)
    if (isCreated) {
      setCurrent({ focus: CREATED_FOCUS, topRow: 0 })
    }
  }
  return (
    <>
      <AlbumTiles {...props} {...{ current, setCurrent, isNaming, startNaming }} />
      {isNaming && <NewAlbumDialog editing={editing} keys={keys} onClose={close} />}
    </>
  )
}

interface AlbumTilesProps extends AlbumGridProps {
  readonly current: GridPosition
  readonly setCurrent: (position: GridPosition) => void
  readonly isNaming: boolean
  readonly startNaming: () => void
}

function AlbumTiles(props: AlbumTilesProps): JSX.Element {
  const { tiles, library, keys, back, intent, current, setCurrent, isNaming } = props
  return (
    <Grid<Tile>
      label={albumsTitle(intent)}
      variant="albums"
      items={tiles}
      shape={SHAPE}
      position={current}
      keys={keys}
      keyOf={(tile) => ('id' in tile ? tile.id : tile.kind)}
      renderTile={(tile) =>
        'id' in tile ? <AlbumTile album={tile} library={library} /> : <NewAlbumTile />
      }
      onMove={setCurrent}
      onOpen={(tile, from) => {
        openTile(props, tile, from)
      }}
      onBack={back}
      isAway={isNaming}
    />
  )
}

// An album opens, but one the server is still creating; the first tile names a new one.
function openTile(props: AlbumTilesProps, tile: Tile, from: GridPosition): void {
  const { open, intent, editing } = props
  if (!('id' in tile)) {
    props.startNaming()
  } else if (isProvisional(tile)) {
    editing.notify(EDIT_MESSAGES.albumNotReady)
  } else {
    open(from, albumScreen(tile, intent))
  }
}

interface NewAlbumDialogProps {
  readonly editing: EditingControls
  readonly keys: ScreenProps['keys']
  readonly onClose: (isCreated: boolean) => void
}

// An empty album, named after the day unless another name is typed.
function NewAlbumDialog({ editing, keys, onClose }: NewAlbumDialogProps): JSX.Element {
  return (
    <NameDialog
      title={EDIT_MESSAGES.newAlbumTitle}
      name={suggestionText(suggestedName([], editing.today()))}
      confirmText={EDIT_MESSAGES.create}
      isTypingFirst={false}
      keys={keys}
      onConfirm={(name) => {
        onClose(true)
        const album = provisionalAlbum(name, [], editing.nextSerial())
        void editing.commit({ kind: ChangeKind.CreateAlbum, album, photoIds: [] })
      }}
      onCancel={() => {
        onClose(false)
      }}
    />
  )
}

function NewAlbumTile(): JSX.Element {
  return (
    <span class="new-album-tile">
      <span class="new-album-plus" aria-hidden="true">
        +
      </span>
      <span class="tile-title">{EDIT_MESSAGES.newAlbum}</span>
    </span>
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
