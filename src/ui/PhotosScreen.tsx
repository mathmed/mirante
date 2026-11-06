import type { JSX } from 'preact'
import { useCallback, useMemo, useState } from 'preact/hooks'

import type { BookSource } from '../core/book-source.ts'
import { loadAlbumPhotos, loadMonthPhotos } from '../core/gallery.ts'
import { type GridPosition, START_POSITION } from '../core/grid.ts'
import { bookScreen } from '../core/navigation.ts'
import {
  type Album,
  ImageSize,
  type Photo,
  type PhotoLibrary,
  type TimelineMonth,
} from '../core/photo-library.ts'
import { SourceKind } from '../core/presentation-source.ts'
import { slideOf } from '../core/presentation.ts'
import { BookIcon } from './BookIcon.tsx'
import { Frame } from './Frame.tsx'
import { Grid } from './Grid.tsx'
import { Loaded } from './Loaded.tsx'
import { MESSAGES, monthTitle, type PanelText, photoDateText } from './messages.ts'
import { Picture } from './Picture.tsx'
import type { ScreenProps } from './screen-props.ts'
import { useLibraryLoad } from './use-load.ts'
import { SAME_SLIDES } from './use-presentation.ts'
import { Viewer } from './Viewer.tsx'

const SHAPE = { columns: 6, visibleRows: 3 }

// The first tile of the grid opens the photos as a book; the photos follow it.
const BOOK_TILE = { kind: 'book' } as const
type Tile = Photo | typeof BOOK_TILE
// An album or a month opens on its first photo, beside the book.
const FIRST_PHOTO: GridPosition = { focus: 1, topRow: 0 }

export interface AlbumScreenProps extends ScreenProps {
  readonly album: Album
}

export function AlbumScreen(props: AlbumScreenProps): JSX.Element {
  const { library, album } = props
  const task = useCallback(async () => loadAlbumPhotos(library, album), [library, album])
  const source = useMemo(() => ({ kind: SourceKind.Album, album }) as const, [album])
  return (
    <PhotosScreen
      {...props}
      title={album.name}
      task={task}
      source={source}
      emptyText={MESSAGES.emptyAlbum}
    />
  )
}

export interface MonthScreenProps extends ScreenProps {
  readonly month: TimelineMonth
}

export function MonthScreen(props: MonthScreenProps): JSX.Element {
  const { library, month } = props
  const task = useCallback(async () => loadMonthPhotos(library, month), [library, month])
  const source = useMemo(() => ({ kind: SourceKind.Month, month }) as const, [month])
  return (
    <PhotosScreen
      {...props}
      title={monthTitle(month)}
      task={task}
      source={source}
      emptyText={MESSAGES.emptyMonth}
    />
  )
}

interface PhotosScreenProps extends ScreenProps {
  readonly title: string
  readonly task: () => Promise<readonly Photo[]>
  // What the first tile opens as a book.
  readonly source: BookSource
  readonly emptyText: PanelText
}

// The photos of an album or of a month in a grid of thumbnails, after the tile that opens them as
// a book; Enter opens the viewer over it.
function PhotosScreen(props: PhotosScreenProps): JSX.Element {
  const { title, task, emptyText, keys, reportError, back } = props
  const load = useLibraryLoad(task, reportError)
  return (
    <Frame title={title}>
      <Loaded
        load={load}
        emptyText={emptyText}
        keys={keys}
        onBack={back}
        render={(photos) => <PhotoBrowser photos={photos} {...props} />}
      />
    </Frame>
  )
}

interface PhotoBrowserProps extends PhotosScreenProps {
  readonly photos: readonly Photo[]
}

// The grid leaves the screen while the viewer is open, its thumbnails unloaded; Back brings it back
// with the focus on the photo the viewer showed last. The viewer shows the photos in the order of
// the grid, paused, and its slideshow goes around them again.
function PhotoBrowser(props: PhotoBrowserProps): JSX.Element {
  const slides = useMemo(() => props.photos.map(slideOf), [props.photos])
  const { position, setPosition, viewing, view, close } = useViewing(props.position)
  if (viewing !== undefined) {
    return (
      <Viewer
        {...props}
        slides={slides}
        start={viewing}
        shouldPlay={false}
        rounds={SAME_SLIDES}
        onClose={close}
      />
    )
  }
  return <PhotoGrid {...props} position={position} onMove={setPosition} onOpen={view} />
}

interface Viewing {
  readonly position: GridPosition
  readonly setPosition: (position: GridPosition) => void
  // The photo open in the viewer, if any.
  readonly viewing: number | undefined
  readonly view: (index: number, from: GridPosition) => void
  readonly close: (index: number) => void
}

// A screen opened anew starts at START_POSITION itself (navigation.ts): then the grid opens on the
// first photo; back from the book, on the tile that opened it.
function useViewing(start: GridPosition): Viewing {
  const [position, setPosition] = useState<GridPosition>(
    start === START_POSITION ? FIRST_PHOTO : start,
  )
  const [viewing, setViewing] = useState<number | undefined>(undefined)
  const view = useCallback((index: number, from: GridPosition) => {
    setPosition(from)
    setViewing(index)
  }, [])
  // The photos follow the tile of the book.
  const close = useCallback((index: number) => {
    setPosition((previous) => ({ focus: index + 1, topRow: previous.topRow }))
    setViewing(undefined)
  }, [])
  return { position, setPosition, viewing, view, close }
}

interface PhotoGridProps extends PhotoBrowserProps {
  readonly onMove: (position: GridPosition) => void
  readonly onOpen: (index: number, from: GridPosition) => void
}

function PhotoGrid(props: PhotoGridProps): JSX.Element {
  const { photos, title, library, keys, position, back, onMove, onOpen } = props
  const tiles = useMemo(() => [BOOK_TILE, ...photos], [photos])
  return (
    <Grid<Tile>
      label={title}
      variant="photos"
      items={tiles}
      shape={SHAPE}
      position={position}
      keys={keys}
      keyOf={(tile) => ('id' in tile ? tile.id : tile.kind)}
      renderTile={(tile) =>
        'id' in tile ? <PhotoTile photo={tile} library={library} /> : <SeeAsBookTile />
      }
      onMove={onMove}
      onOpen={(tile, from) => {
        if ('id' in tile) {
          onOpen(photos.indexOf(tile), from)
        } else {
          props.open(from, bookScreen(props.source))
        }
      }}
      onBack={back}
    />
  )
}

function SeeAsBookTile(): JSX.Element {
  return (
    <span class="book-tile">
      <BookIcon />
      <span class="book-tile-title">{MESSAGES.seeAsBook}</span>
    </span>
  )
}

interface PhotoTileProps {
  readonly photo: Photo
  readonly library: PhotoLibrary
}

function PhotoTile({ photo, library }: PhotoTileProps): JSX.Element {
  return (
    <Picture
      url={library.imageUrl(photo.id, ImageSize.Thumbnail)}
      alt={photoDateText(photo.date)}
      missingText={MESSAGES.photoUnavailable}
    />
  )
}
