import { RemoteKey } from './remote-key.ts'

// Spatial navigation in a grid of any number of columns that shows a few rows at a time: where the
// focus goes on each arrow, which rows are on the screen, and which items are worth rendering.
export interface GridLayout {
  readonly count: number
  readonly columns: number
  readonly visibleRows: number
}

// The focused item and the first row on the screen.
export interface GridPosition {
  readonly focus: number
  readonly topRow: number
}

export interface IndexRange {
  // The first index in the range, and the index right after the last one.
  readonly start: number
  readonly end: number
}

export interface GridSlot {
  readonly column: number
  // Counted from the first row on the screen: negative above it.
  readonly row: number
  // False for the rows rendered around the screen.
  readonly isOnScreen: boolean
}

export const START_POSITION: GridPosition = { focus: 0, topRow: 0 }

// Keeps the focus on an item that exists and on the screen, moving the rows as little as possible:
// what a remembered position becomes when the grid comes back with fewer items, or none.
export function placeInGrid(position: GridPosition, layout: GridLayout): GridPosition {
  const focus = Math.max(0, Math.min(position.focus, layout.count - 1))
  const focusRow = rowOf(focus, layout.columns)
  const lastTopRow = Math.max(0, rowCount(layout) - layout.visibleRows)
  const topRow = Math.min(
    Math.max(position.topRow, focusRow - layout.visibleRows + 1),
    focusRow,
    lastTopRow,
  )
  return { focus, topRow: Math.max(0, topRow) }
}

export function moveInGrid(
  position: GridPosition,
  key: RemoteKey,
  layout: GridLayout,
): GridPosition {
  const focus = nextFocus(position.focus, key, layout)
  return placeInGrid({ focus, topRow: position.topRow }, layout)
}

// The rows on the screen and a few around them, so that the images next to the screen are ready
// before the focus reaches them; everything else is left out.
export function renderedRange(
  position: GridPosition,
  layout: GridLayout,
  bufferRows: number,
): IndexRange {
  const firstRow = Math.max(0, position.topRow - bufferRows)
  const afterLastRow = position.topRow + layout.visibleRows + bufferRows
  return {
    start: Math.min(firstRow * layout.columns, layout.count),
    end: Math.min(afterLastRow * layout.columns, layout.count),
  }
}

export function slotOf(index: number, position: GridPosition, layout: GridLayout): GridSlot {
  const row = rowOf(index, layout.columns) - position.topRow
  return { column: index % layout.columns, row, isOnScreen: row >= 0 && row < layout.visibleRows }
}

type Move = (focus: number, layout: GridLayout) => number

const MOVES: ReadonlyMap<RemoteKey, Move> = new Map<RemoteKey, Move>([
  [RemoteKey.Left, leftOf],
  [RemoteKey.Right, rightOf],
  [RemoteKey.Up, above],
  [RemoteKey.Down, below],
])

function nextFocus(focus: number, key: RemoteKey, layout: GridLayout): number {
  const move = MOVES.get(key)
  return move === undefined ? focus : move(focus, layout)
}

function leftOf(focus: number, layout: GridLayout): number {
  return focus % layout.columns === 0 ? focus : focus - 1
}

function rightOf(focus: number, layout: GridLayout): number {
  const isLastColumn = focus % layout.columns === layout.columns - 1
  return isLastColumn || focus >= layout.count - 1 ? focus : focus + 1
}

function above(focus: number, layout: GridLayout): number {
  return focus < layout.columns ? focus : focus - layout.columns
}

// Down from a row above a shorter last row lands on its last item, as long as there is a row below.
function below(focus: number, layout: GridLayout): number {
  const lastIndex = layout.count - 1
  if (rowOf(focus, layout.columns) >= rowOf(lastIndex, layout.columns)) {
    return focus
  }
  return Math.min(focus + layout.columns, lastIndex)
}

function rowOf(index: number, columns: number): number {
  return Math.floor(index / columns)
}

function rowCount(layout: GridLayout): number {
  return Math.ceil(layout.count / layout.columns)
}
