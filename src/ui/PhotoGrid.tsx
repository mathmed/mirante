import type { JSX } from 'preact'
import { useMemo, useState } from 'preact/hooks'

import { blockOf, EditAction, gridActions, isPhotoAction, refusalOf } from '../core/edit-actions.ts'
import { StepKind } from '../core/edit-flow.ts'
import type { GridPosition } from '../core/grid.ts'
import { bookScreen } from '../core/navigation.ts'
import { ImageSize, type Photo, type PhotoLibrary } from '../core/photo-library.ts'
import {
  isSelected,
  NO_SELECTION,
  selectedPhotos,
  type Selection,
  STARTED_SELECTION,
  toggleSelected,
} from '../core/selection.ts'
import { ActionBar } from './ActionBar.tsx'
import { BookIcon } from './BookIcon.tsx'
import { blockText, EDIT_MESSAGES, selectingText } from './edit-messages.ts'
import { Grid } from './Grid.tsx'
import { MESSAGES, photoDateText } from './messages.ts'
import type { PhotoBrowserProps, Viewing } from './photos-props.ts'
import { Picture } from './Picture.tsx'
import type { EditFlow } from './use-edit-flow.ts'

const SHAPE = { columns: 6, visibleRows: 3 }

// The first tile of the grid opens the photos as a book; the photos follow it.
const BOOK_TILE = { kind: 'book' } as const
type Tile = Photo | typeof BOOK_TILE

export interface PhotoGridProps extends PhotoBrowserProps {
  readonly flow: EditFlow
  readonly viewing: Viewing
  readonly selection: Selection
  readonly setSelection: (selection: Selection) => void
}

// The bar of actions above the grid, when anything can change: Up on the first row reaches it, and
// Back too while the grid selects. Selecting, Enter marks or unmarks the photo in focus.
export function PhotoGrid(props: PhotoGridProps): JSX.Element {
  const { photos, context, selection, flow } = props
  const actions = gridActions(context, selection, photos.length)
  const isAlone = photos.length === 0
  const bar = useBar(props, actions.length, isAlone)
  const isIdle = flow.step.kind === StepKind.Idle
  return (
    <>
      <PhotoBar {...props} actions={actions} bar={bar} isIdle={isIdle} isAlone={isAlone} />
      {isAlone ? (
        <p class="status-text">{props.emptyText.title}</p>
      ) : (
        <TileGrid {...props} isAway={bar.focus !== undefined || !isIdle} onLeaveUp={bar.enter} />
      )}
    </>
  )
}

interface PhotoBarProps extends PhotoGridProps {
  readonly actions: readonly EditAction[]
  readonly bar: Bar
  // Whether no step of a change covers the screen.
  readonly isIdle: boolean
  // Without photos, Back from the bar leaves the screen.
  readonly isAlone: boolean
}

function PhotoBar(props: PhotoBarProps): JSX.Element | null {
  const { actions, bar, isIdle, isAlone } = props
  if (actions.length === 0) {
    return null
  }
  return (
    <ActionBar
      actions={actions}
      focus={isIdle ? bar.focus : undefined}
      note={noteOf(props)}
      keys={props.keys}
      onMove={bar.setFocus}
      onRun={(action) => {
        runAction(props, bar.leave, action)
      }}
      onLeave={bar.leave}
      onBack={isAlone ? props.back : bar.leave}
    />
  )
}

interface Bar {
  // The action in focus; undefined while the grid has it.
  readonly focus: number | undefined
  readonly setFocus: (focus: number) => void
  // Up from the grid: to the bar, or, without one, a word on why nothing can change.
  readonly enter: () => void
  readonly leave: () => void
}

// Without photos, the bar keeps the focus; the actions change (the undo goes away), the focus stays
// on one of them.
function useBar(props: PhotoGridProps, count: number, isAlone: boolean): Bar {
  const { editing, context } = props
  const [focus, setFocus] = useState<number | undefined>(undefined)
  const shown = isAlone ? (focus ?? 0) : focus
  const enter = (): void => {
    if (count > 0) {
      setFocus(0)
    } else {
      editing.notify(blockText(refusalOf(context.access)))
    }
  }
  const leave = (): void => {
    setFocus(undefined)
  }
  const clamped = shown === undefined ? undefined : Math.min(shown, count - 1)
  return { focus: clamped, setFocus, enter, leave }
}

// What the selection holds, or why some actions are off.
function noteOf({ selection, photos, context }: PhotoGridProps): string | undefined {
  if (selection.isActive) {
    return selectingText(selectedPhotos(selection, photos).length)
  }
  const block = blockOf(context.access)
  return block === undefined ? undefined : blockText(block)
}

// An action of the bar: the selection starts or ends, or the photos marked are acted on.
function runAction(props: PhotoGridProps, leave: () => void, action: EditAction): void {
  const { selection, setSelection, photos, flow, editing } = props
  const marked = selectedPhotos(selection, photos)
  if (isPhotoAction(action) && marked.length === 0) {
    editing.notify(EDIT_MESSAGES.selectFirst)
    return
  }
  leave()
  if (action === EditAction.Select) {
    setSelection(STARTED_SELECTION)
  } else if (action === EditAction.EndSelection) {
    setSelection(NO_SELECTION)
  } else {
    flow.run(action, marked)
  }
}

interface TileGridProps extends PhotoGridProps {
  readonly isAway: boolean
  readonly onLeaveUp: () => void
}

function TileGrid(props: TileGridProps): JSX.Element {
  const { photos, title, keys, viewing, selection } = props
  const tiles = useMemo(() => [BOOK_TILE, ...photos], [photos])
  return (
    <Grid<Tile>
      label={title}
      variant="photos"
      items={tiles}
      shape={SHAPE}
      position={viewing.position}
      keys={keys}
      keyOf={(tile) => ('id' in tile ? tile.id : tile.kind)}
      renderTile={(tile) => tileOf(props, tile)}
      onMove={viewing.setPosition}
      onOpen={(tile, from) => {
        openTile(props, tile, from)
      }}
      onBack={selection.isActive ? props.onLeaveUp : props.back}
      onLeaveUp={props.onLeaveUp}
      isAway={props.isAway}
    />
  )
}

function tileOf({ library, selection }: TileGridProps, tile: Tile): JSX.Element {
  return 'id' in tile ? (
    <PhotoTile photo={tile} library={library} isMarked={isSelected(selection, tile.id)} />
  ) : (
    <SeeAsBookTile />
  )
}

// Enter on a photo opens the viewer, or marks it while the grid selects; on the first tile, opens
// the book, but while the grid selects.
function openTile(props: TileGridProps, tile: Tile, from: GridPosition): void {
  const { selection, setSelection, viewing, photos } = props
  if (!('id' in tile)) {
    if (!selection.isActive) {
      props.open(from, bookScreen(props.source))
    }
  } else if (selection.isActive) {
    setSelection(toggleSelected(selection, tile.id))
  } else {
    viewing.view(photos.indexOf(tile), from)
  }
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
  // Marked in a selection.
  readonly isMarked: boolean
}

function PhotoTile({ photo, library, isMarked }: PhotoTileProps): JSX.Element {
  return (
    <>
      <Picture
        url={library.imageUrl(photo.id, ImageSize.Thumbnail)}
        alt={photoDateText(photo.date)}
        missingText={MESSAGES.photoUnavailable}
      />
      {isMarked && <span class="tile-mark" aria-label={EDIT_MESSAGES.marked} />}
    </>
  )
}
