import type { JSX } from 'preact'
import { useCallback, useEffect, useRef } from 'preact/hooks'

import {
  type FeedLayout,
  type FeedRow,
  FeedRowKind,
  moveInFeed,
  placeInFeed,
  renderedRows,
  slotOfRow,
} from '../core/feed-layout.ts'
import type { GridPosition } from '../core/grid.ts'
import { ImageSize, type Photo, type PhotoLibrary } from '../core/photo-library.ts'
import { type KeySource, RemoteKey } from '../core/remote-key.ts'
import { MESSAGES, monthTitle, photoCountText, photoDateText } from './messages.ts'
import { Picture } from './Picture.tsx'
import { useRemoteKeys } from './use-remote-keys.ts'

const PERCENT = 100

export interface FeedProps {
  readonly layout: FeedLayout
  readonly position: GridPosition
  readonly library: PhotoLibrary
  readonly keys: KeySource
  readonly onMove: (position: GridPosition) => void
  // Enter opens the photo in focus; Info presents from it.
  readonly onOpen: (index: number, position: GridPosition) => void
  readonly onPresent: (index: number, position: GridPosition) => void
  readonly onBack: () => void
}

// Every photo read, in a grid of thumbnails where each month opens with its heading. Only the rows
// on the screen and a row's height around them are rendered; the rest is left out, its images
// unloaded.
export function Feed(props: FeedProps): JSX.Element {
  const { layout, library } = props
  const position = placeInFeed(props.position, layout)
  useFeedKeys(props, position)
  const { start, end } = renderedRows(position, layout, layout.shape.rowHeight)
  return (
    <ul class="grid grid-photos feed" aria-label={MESSAGES.allPhotosTitle}>
      {([] as JSX.Element[]).concat(
        ...layout.rows.slice(start, end).map((row) => rowItems({ row, position, layout }, library)),
      )}
    </ul>
  )
}

// A heading, or the cells of a row of photos.
function rowItems(props: RowProps, library: PhotoLibrary): JSX.Element[] {
  const { row, position } = props
  if (row.kind === FeedRowKind.Heading) {
    return [<MonthHeading key={`month ${row.month.month.key}`} {...props} />]
  }
  return row.photos.map((photo, column) => (
    <PhotoCell
      key={photo.id}
      {...props}
      photo={photo}
      library={library}
      column={column}
      isFocused={row.firstPhoto + column === position.focus}
    />
  ))
}

function useFeedKeys(props: FeedProps, position: GridPosition): void {
  const { layout, onMove, onOpen, onPresent, onBack } = props
  const onKey = useCallback(
    (key: RemoteKey) => {
      if (key === RemoteKey.Back) {
        onBack()
      } else if (key === RemoteKey.Enter) {
        onOpen(position.focus, position)
      } else if (key === RemoteKey.Info) {
        onPresent(position.focus, position)
      } else {
        onMove(moveInFeed(position, key, layout))
      }
    },
    [layout, position, onMove, onOpen, onPresent, onBack],
  )
  useRemoteKeys(props.keys, onKey)
}

interface RowProps {
  readonly row: FeedRow
  readonly position: GridPosition
  readonly layout: FeedLayout
}

// The name of the month and how many photos it has, on a row of its own.
function MonthHeading({ row, position, layout }: RowProps): JSX.Element {
  const { month, photos } = row.month
  const placed = placement({ row, position, layout }, 0, PERCENT)
  return (
    <li class={`feed-month${placed.offscreen}`} style={placed.style}>
      <h2 class="feed-month-title">{monthTitle(month)}</h2>
      <span class="feed-month-count">{photoCountText(photos.length)}</span>
    </li>
  )
}

interface PhotoCellProps extends RowProps {
  readonly photo: Photo
  readonly library: PhotoLibrary
  readonly column: number
  readonly isFocused: boolean
}

// The focused cell holds the browser's focus, so that :focus shows where the remote control is.
function PhotoCell(props: PhotoCellProps): JSX.Element {
  const { photo, library, layout, column, isFocused } = props
  const cellRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (isFocused) {
      cellRef.current?.focus({ preventScroll: true })
    }
  }, [isFocused])
  const placed = placement(props, column, PERCENT / layout.shape.columns)
  return (
    <li
      ref={cellRef}
      class={`cell${placed.offscreen}`}
      style={placed.style}
      tabIndex={-1}
      aria-current={isFocused}
    >
      <div class="tile">
        <Picture
          url={library.imageUrl(photo.id, ImageSize.Thumbnail)}
          alt={photoDateText(photo.date)}
          missingText={MESSAGES.photoUnavailable}
        />
      </div>
    </li>
  )
}

interface Placement {
  readonly style: Readonly<Record<string, string>>
  // The class of the rows around the screen, which load their images without showing.
  readonly offscreen: string
}

// Placed with a transform, which the TVs move without laying the page out again. A transform in
// percent moves by the element's own size: down by its own heights, across by its own widths.
function placement({ row, position, layout }: RowProps, column: number, width: number): Placement {
  const slot = slotOfRow(row, position, layout)
  const down = (PERCENT * slot.top) / row.height
  return {
    style: {
      width: `${String(width)}%`,
      height: `${String((PERCENT * row.height) / layout.shape.screenHeight)}%`,
      transform: `translate(${String(column * PERCENT)}%, ${String(down)}%)`,
    },
    offscreen: slot.isOnScreen ? '' : ' cell-offscreen',
  }
}
