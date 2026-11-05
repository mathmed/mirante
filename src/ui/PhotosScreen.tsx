import type { JSX } from 'preact'
import { useCallback, useState } from 'preact/hooks'

import { loadAlbumPhotos, loadMonthPhotos } from '../core/gallery.ts'
import { type GridPosition, START_POSITION } from '../core/grid.ts'
import {
  type Album,
  ImageSize,
  type Photo,
  type PhotoLibrary,
  type TimelineMonth,
} from '../core/photo-library.ts'
import { Frame } from './Frame.tsx'
import { Grid } from './Grid.tsx'
import { Loaded } from './Loaded.tsx'
import { MESSAGES, monthTitle, type PanelText, photoDateText } from './messages.ts'
import { Picture } from './Picture.tsx'
import type { ScreenProps } from './screen-props.ts'
import { useLibraryLoad } from './use-load.ts'
import { Viewer } from './Viewer.tsx'

const SHAPE = { columns: 6, visibleRows: 3 }

interface PhotoScreenProps extends ScreenProps {
  readonly slideshowSeconds: number
}

export interface AlbumScreenProps extends PhotoScreenProps {
  readonly album: Album
}

export function AlbumScreen(props: AlbumScreenProps): JSX.Element {
  const { library, album } = props
  const task = useCallback(async () => loadAlbumPhotos(library, album), [library, album])
  return <PhotosScreen {...props} title={album.name} task={task} emptyText={MESSAGES.emptyAlbum} />
}

export interface MonthScreenProps extends PhotoScreenProps {
  readonly month: TimelineMonth
}

export function MonthScreen(props: MonthScreenProps): JSX.Element {
  const { library, month } = props
  const task = useCallback(async () => loadMonthPhotos(library, month), [library, month])
  return (
    <PhotosScreen
      {...props}
      title={monthTitle(month)}
      task={task}
      emptyText={MESSAGES.emptyMonth}
    />
  )
}

interface PhotosScreenProps extends PhotoScreenProps {
  readonly title: string
  readonly task: () => Promise<readonly Photo[]>
  readonly emptyText: PanelText
}

// The photos of an album or of a month in a grid of thumbnails; Enter opens the viewer over it.
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
// with the focus on the photo the viewer showed last.
function PhotoBrowser(props: PhotoBrowserProps): JSX.Element {
  const [position, setPosition] = useState<GridPosition>(START_POSITION)
  const [viewing, setViewing] = useState<number | undefined>(undefined)
  const close = useCallback((index: number) => {
    setPosition((previous) => ({ focus: index, topRow: previous.topRow }))
    setViewing(undefined)
  }, [])
  if (viewing !== undefined) {
    return <Viewer {...props} start={viewing} onClose={close} />
  }
  return (
    <PhotoGrid
      {...props}
      position={position}
      onMove={setPosition}
      onOpen={(index, from) => {
        setPosition(from)
        setViewing(index)
      }}
    />
  )
}

interface PhotoGridProps extends PhotoBrowserProps {
  readonly onMove: (position: GridPosition) => void
  readonly onOpen: (index: number, from: GridPosition) => void
}

function PhotoGrid({
  photos,
  title,
  library,
  keys,
  position,
  back,
  onMove,
  onOpen,
}: PhotoGridProps): JSX.Element {
  return (
    <Grid
      label={title}
      variant="photos"
      items={photos}
      shape={SHAPE}
      position={position}
      keys={keys}
      keyOf={(photo) => photo.id}
      renderTile={(photo) => <PhotoTile photo={photo} library={library} />}
      onMove={onMove}
      onOpen={(photo, from) => {
        onOpen(photos.indexOf(photo), from)
      }}
      onBack={back}
    />
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
