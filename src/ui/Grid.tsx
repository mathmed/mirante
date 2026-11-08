import type { ComponentChildren, JSX } from 'preact'
import { useCallback, useEffect, useRef } from 'preact/hooks'

import {
  type GridLayout,
  type GridPosition,
  type GridSlot,
  moveInGrid,
  placeInGrid,
  renderedRange,
  slotOf,
} from '../core/grid.ts'
import { leavesGridUp } from '../core/line-focus.ts'
import { type KeySource, RemoteKey } from '../core/remote-key.ts'
import { useRemoteKeys } from './use-remote-keys.ts'

// The rows rendered above and below the screen, so that their images are ready before the focus
// reaches them. Everything further away is left out, its images unloaded.
const BUFFER_ROWS = 1
const PERCENT = 100

interface GridShape {
  readonly columns: number
  readonly visibleRows: number
}

export interface GridProps<T> {
  readonly label: string
  // The look of the tiles: a class of styles.css.
  readonly variant: string
  readonly items: readonly T[]
  readonly shape: GridShape
  readonly position: GridPosition
  readonly keys: KeySource
  readonly keyOf: (item: T) => string
  readonly renderTile: (item: T) => JSX.Element
  readonly onMove: (position: GridPosition) => void
  readonly onOpen: (item: T, position: GridPosition) => void
  readonly onBack: () => void
  // Up on the first row, to what is above the grid; without it, Up stops there.
  readonly onLeaveUp?: () => void
  // While the focus is away (on the bar above the grid, or a dialog over it), the grid neither
  // listens nor shows its focus.
  readonly isAway?: boolean
}

// What an away grid listens to: nothing.
const NO_KEYS: KeySource = { subscribe: () => () => undefined }

// A grid driven by the arrows, which only renders the rows on the screen and a few around them.
export function Grid<T>(props: GridProps<T>): JSX.Element {
  const { items, shape, keyOf, renderTile } = props
  const layout: GridLayout = { count: items.length, ...shape }
  const position = placeInGrid(props.position, layout)
  useGridKeys(props, layout, position)
  const { start, end } = renderedRange(position, layout, BUFFER_ROWS)
  return (
    <ul class={`grid grid-${props.variant}`} aria-label={props.label}>
      {items.slice(start, end).map((item, offset) => {
        const index = start + offset
        return (
          <Cell
            key={keyOf(item)}
            shape={shape}
            slot={slotOf(index, position, layout)}
            isFocused={props.isAway !== true && index === position.focus}
          >
            {renderTile(item)}
          </Cell>
        )
      })}
    </ul>
  )
}

function useGridKeys<T>(props: GridProps<T>, layout: GridLayout, position: GridPosition): void {
  const { items, onOpen, onBack } = props
  const move = useMove(props, layout, position)
  const onKey = useCallback(
    (key: RemoteKey) => {
      const item = items[position.focus]
      if (key === RemoteKey.Back) {
        onBack()
      } else if (key === RemoteKey.Enter) {
        openItem(item, position, onOpen)
      } else {
        move(key)
      }
    },
    [items, position, move, onOpen, onBack],
  )
  useRemoteKeys(props.isAway === true ? NO_KEYS : props.keys, onKey)
}

function useMove<T>(
  props: GridProps<T>,
  layout: GridLayout,
  position: GridPosition,
): (key: RemoteKey) => void {
  const { onMove, onLeaveUp } = props
  return useCallback(
    (key: RemoteKey) => {
      const next = moveInGrid(position, key, layout)
      if (onLeaveUp !== undefined && leavesGridUp(key, position, next)) {
        onLeaveUp()
      } else {
        onMove(next)
      }
    },
    [layout, position, onMove, onLeaveUp],
  )
}

function openItem<T>(
  item: T | undefined,
  position: GridPosition,
  onOpen: (item: T, position: GridPosition) => void,
): void {
  if (item !== undefined) {
    onOpen(item, position)
  }
}

interface CellProps {
  readonly shape: GridShape
  readonly slot: GridSlot
  readonly isFocused: boolean
  readonly children: ComponentChildren
}

// Placed with a transform, which the TVs move without laying the page out again. The focused cell
// holds the browser's focus, so that :focus shows where the remote control is.
function Cell({ shape, slot, isFocused, children }: CellProps): JSX.Element {
  const cellRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (isFocused) {
      cellRef.current?.focus({ preventScroll: true })
    }
  }, [isFocused])
  const style = {
    width: `${String(PERCENT / shape.columns)}%`,
    height: `${String(PERCENT / shape.visibleRows)}%`,
    transform: `translate(${String(slot.column * PERCENT)}%, ${String(slot.row * PERCENT)}%)`,
  }
  return (
    <li
      ref={cellRef}
      class={slot.isOnScreen ? 'cell' : 'cell cell-offscreen'}
      style={style}
      tabIndex={-1}
      aria-current={isFocused}
    >
      <div class="tile">{children}</div>
    </li>
  )
}
