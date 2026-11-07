import type { JSX } from 'preact'
import { useCallback, useMemo } from 'preact/hooks'

import { isProvisional } from '../core/album-name.ts'
import { type EditContext, gridActions } from '../core/edit-actions.ts'
import { loadAlbumPhotos, loadMonthPhotos } from '../core/gallery.ts'
import { type LibraryEdits, visibleAlbum, visiblePhotos } from '../core/library-edits.ts'
import { type LoadState, LoadStatus } from '../core/loading.ts'
import type { Album, Photo, TimelineMonth } from '../core/photo-library.ts'
import { SourceKind } from '../core/presentation-source.ts'
import { NO_SELECTION } from '../core/selection.ts'
import { Frame } from './Frame.tsx'
import { Loaded } from './Loaded.tsx'
import { MESSAGES, monthTitle } from './messages.ts'
import { PhotoBrowser } from './PhotoBrowser.tsx'
import type { PhotosScreenProps } from './photos-props.ts'
import type { ScreenProps } from './screen-props.ts'
import type { EditingControls } from './use-editing.ts'
import { useLibraryLoad } from './use-load.ts'

export interface AlbumScreenProps extends ScreenProps {
  readonly album: Album
}

// The photos of an album, under its name as the changes of the visit left it.
export function AlbumScreen(props: AlbumScreenProps): JSX.Element {
  const { library, album, editing } = props
  const task = useCallback(async () => loadAlbumPhotos(library, album), [library, album])
  const source = useMemo(() => ({ kind: SourceKind.Album, album }) as const, [album])
  const shown = visibleAlbum(album, editing.edits)
  return (
    <PhotosScreen
      {...props}
      title={shown.name}
      task={task}
      source={source}
      emptyText={MESSAGES.emptyAlbum}
      album={shown}
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
      album={undefined}
    />
  )
}

// The photos of an album or of a month, as the changes of the visit left them. An album emptied
// meanwhile keeps its actions (to rename or delete it, to undo), the bar in focus.
function PhotosScreen(props: PhotosScreenProps): JSX.Element {
  const { title, task, emptyText, keys, reportError, back, editing, album } = props
  const load = useLibraryLoad(task, reportError)
  const state = useMemo(
    () => visibleState(load.state, editing.edits, album?.id),
    [load.state, editing.edits, album?.id],
  )
  const context = editContextOf(editing, album)
  const render = (photos: readonly Photo[]): JSX.Element => (
    <PhotoBrowser {...props} photos={photos} context={context} />
  )
  return (
    <Frame title={title}>
      {isKeptWhenEmpty(state, context) ? (
        render([])
      ) : (
        <Loaded
          load={{ state, retry: load.retry }}
          emptyText={emptyText}
          keys={keys}
          onBack={back}
          render={render}
        />
      )}
    </Frame>
  )
}

function visibleState(
  state: LoadState<readonly Photo[]>,
  edits: LibraryEdits,
  albumId: string | undefined,
): LoadState<readonly Photo[]> {
  return state.status === LoadStatus.Loaded
    ? { ...state, value: visiblePhotos(state.value, edits, albumId) }
    : state
}

// An album the server has not created yet cannot change.
function editContextOf(editing: EditingControls, album: Album | undefined): EditContext {
  const albumId = album === undefined || isProvisional(album) ? undefined : album.id
  return { access: editing.access, albumId, canUndo: editing.canUndo }
}

function isKeptWhenEmpty(state: LoadState<readonly Photo[]>, context: EditContext): boolean {
  const isEmpty = state.status === LoadStatus.Loaded && state.value.length === 0
  return isEmpty && gridActions(context, NO_SELECTION, 0).length > 0
}
