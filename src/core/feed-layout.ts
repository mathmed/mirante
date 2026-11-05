import { type GridPosition, type IndexRange, START_POSITION } from './grid.ts'
import type { FeedMonth } from './photo-feed.ts'
import type { Photo } from './photo-library.ts'
import { RemoteKey } from './remote-key.ts'

// The feed on the screen: a grid of photos, each month opening with its heading on a row of its
// own, of which only the rows on the screen and those around them are rendered. Heights are in
// units of the screen's choosing; a position is the focused photo and the first row on the screen.
export interface FeedShape {
  readonly columns: number
  // The height of the screen, of a row of photos and of the heading of a month.
  readonly screenHeight: number
  readonly rowHeight: number
  readonly headingHeight: number
}

export const FeedRowKind = {
  Heading: 'heading',
  Photos: 'photos',
} as const

export type FeedRowKind = (typeof FeedRowKind)[keyof typeof FeedRowKind]

// A binary search halves the rows at each step.
const HALVES = 2

export interface FeedRow {
  readonly kind: FeedRowKind
  readonly month: FeedMonth
  // The index of its first photo among every photo of the feed (for a heading, of the first of its
  // month), and its photos (none for a heading).
  readonly firstPhoto: number
  readonly photos: readonly Photo[]
  // From the top of the feed.
  readonly top: number
  readonly height: number
}

export interface FeedLayout {
  readonly shape: FeedShape
  readonly rows: readonly FeedRow[]
  readonly photoCount: number
}

// Where a row stands, from the top of the screen; off the screen when any part of it is.
export interface FeedSlot {
  readonly top: number
  readonly isOnScreen: boolean
}

// A month without photos (a month of videos) has neither a heading nor rows.
export function feedLayout(months: readonly FeedMonth[], shape: FeedShape): FeedLayout {
  const rows: FeedRow[] = []
  let photoCount = 0
  let top = 0
  for (const month of months.filter(({ photos }) => photos.length > 0)) {
    for (const row of monthRows(month, photoCount, shape)) {
      rows.push({ ...row, top })
      top += row.height
    }
    photoCount += month.photos.length
  }
  return { shape, rows, photoCount }
}

// Keeps the focus on a photo that exists and its row on the screen, moving as little as possible;
// a row that comes onto the screen from below brings the heading of its month along when it opens
// the month.
export function placeInFeed(position: GridPosition, layout: FeedLayout): GridPosition {
  if (layout.photoCount === 0) {
    return START_POSITION
  }
  const focus = Math.max(0, Math.min(position.focus, layout.photoCount - 1))
  const focusRow = rowOfPhoto(layout.rows, focus)
  if (focusRow <= position.topRow) {
    return { focus, topRow: withHeading(layout.rows, focusRow) }
  }
  return { focus, topRow: firstRowShowing(layout, focusRow, position.topRow) }
}

// Left and right go through the photos one by one, across rows and months; up and down go to the
// row above or below, in the same column, or to the last photo of a shorter row.
export function moveInFeed(
  position: GridPosition,
  key: RemoteKey,
  layout: FeedLayout,
): GridPosition {
  const move = MOVES.get(key)
  const focus = move === undefined ? position.focus : move(position.focus, layout.rows)
  return placeInFeed({ focus, topRow: position.topRow }, layout)
}

// The rows on the screen and those within this height of it, above and below.
export function renderedRows(
  position: GridPosition,
  layout: FeedLayout,
  bufferHeight: number,
): IndexRange {
  const { rows, shape } = layout
  const screenTop = topOf(rows, position.topRow)
  let start = Math.min(position.topRow, rows.length)
  // The rows follow one another: a row ends where the next one starts.
  while (start > 0 && topOf(rows, start) > screenTop - bufferHeight) {
    start -= 1
  }
  let end = start
  while (end < rows.length && topOf(rows, end) < screenTop + shape.screenHeight + bufferHeight) {
    end += 1
  }
  return { start, end }
}

export function slotOfRow(row: FeedRow, position: GridPosition, layout: FeedLayout): FeedSlot {
  const top = row.top - topOf(layout.rows, position.topRow)
  return { top, isOnScreen: top >= 0 && top + row.height <= layout.shape.screenHeight }
}

// The row that holds the photo: the last row starting at it or before it, which is never a heading
// (a heading starts at the same photo as the row after it).
export function rowOfPhoto(rows: readonly FeedRow[], photo: number): number {
  let low = 0
  let high = rows.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / HALVES)
    if (startsAtOrBefore(rows, middle, photo)) {
      low = middle
    } else {
      high = middle - 1
    }
  }
  return low
}

type Move = (focus: number, rows: readonly FeedRow[]) => number

const MOVES: ReadonlyMap<RemoteKey, Move> = new Map<RemoteKey, Move>([
  [RemoteKey.Left, (focus) => focus - 1],
  [RemoteKey.Right, (focus) => focus + 1],
  [RemoteKey.Up, (focus, rows) => inRowBeside(focus, rows, -1)],
  [RemoteKey.Down, (focus, rows) => inRowBeside(focus, rows, 1)],
])

function monthRows(
  month: FeedMonth,
  firstPhoto: number,
  shape: FeedShape,
): readonly Omit<FeedRow, 'top'>[] {
  const heading = { kind: FeedRowKind.Heading, month, firstPhoto, photos: [] }
  const rows: Omit<FeedRow, 'top'>[] = [{ ...heading, height: shape.headingHeight }]
  for (let start = 0; start < month.photos.length; start += shape.columns) {
    rows.push({
      kind: FeedRowKind.Photos,
      month,
      firstPhoto: firstPhoto + start,
      photos: month.photos.slice(start, start + shape.columns),
      height: shape.rowHeight,
    })
  }
  return rows
}

// The photo in the same column of the row of photos above (-1) or below (1), past the heading of a
// month; the same photo when there is no such row.
function inRowBeside(focus: number, rows: readonly FeedRow[], step: number): number {
  const row = rowOfPhoto(rows, focus)
  const current = rowAt(rows, row)
  const beside = rows[row + step]
  const target = beside?.kind === FeedRowKind.Heading ? rows[row + step + step] : beside
  if (current === undefined || target === undefined) {
    return focus
  }
  const column = focus - current.firstPhoto
  return target.firstPhoto + Math.min(column, target.photos.length - 1)
}

function withHeading(rows: readonly FeedRow[], row: number): number {
  return rows[row - 1]?.kind === FeedRowKind.Heading ? row - 1 : row
}

// The first row on the screen once the focused row, below it, fits at its bottom.
function firstRowShowing(layout: FeedLayout, focusRow: number, topRow: number): number {
  const { rows, shape } = layout
  const focusBottom = topOf(rows, focusRow) + shape.rowHeight
  let first = topRow
  while (first < focusRow && focusBottom - topOf(rows, first) > shape.screenHeight) {
    first += 1
  }
  return first
}

function topOf(rows: readonly FeedRow[], row: number): number {
  return rowAt(rows, row)?.top ?? 0
}

function startsAtOrBefore(rows: readonly FeedRow[], row: number, photo: number): boolean {
  return rows.slice(row, row + 1).every((found) => found.firstPhoto <= photo)
}

function rowAt(rows: readonly FeedRow[], row: number): FeedRow | undefined {
  const [found] = rows.slice(row, row + 1)
  return found
}
