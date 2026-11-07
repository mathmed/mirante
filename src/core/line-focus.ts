import type { GridPosition, IndexRange } from './grid.ts'
import { RemoteKey } from './remote-key.ts'

// The focus in a line of choices: the buttons of a bar, side by side, or the items of a menu, one
// above the other. It stops at both ends.
// The window of a menu keeps the item in focus in its middle, when it can.
const HALF = 2

export const Axis = {
  Row: 'row',
  Column: 'column',
} as const

export type Axis = (typeof Axis)[keyof typeof Axis]

export interface Line {
  readonly count: number
  readonly axis: Axis
}

const STEPS: ReadonlyMap<Axis, ReadonlyMap<RemoteKey, number>> = new Map<
  Axis,
  ReadonlyMap<RemoteKey, number>
>([
  [
    Axis.Row,
    new Map<RemoteKey, number>([
      [RemoteKey.Left, -1],
      [RemoteKey.Right, 1],
    ]),
  ],
  [
    Axis.Column,
    new Map<RemoteKey, number>([
      [RemoteKey.Up, -1],
      [RemoteKey.Down, 1],
    ]),
  ],
])

export function moveInLine(index: number, key: RemoteKey, line: Line): number {
  const step = STEPS.get(line.axis)?.get(key) ?? 0
  return Math.max(0, Math.min(index + step, line.count - 1))
}

// Whether the key leaves the line: the arrow across it, or along it past an end.
export function leavesLine(index: number, key: RemoteKey, line: Line): boolean {
  return isArrow(key) && moveInLine(index, key, line) === index
}

// Up that does not move the focus of a grid (it is on the first row) goes to the bar above it.
export function leavesGridUp(key: RemoteKey, from: GridPosition, to: GridPosition): boolean {
  return key === RemoteKey.Up && from.focus === to.focus
}

// The items of a long menu on the screen: a window of up to this many around the one in focus,
// which moves as little as possible; the rest is left out.
export function lineWindow(focus: number, count: number, visible: number): IndexRange {
  const start = Math.max(0, Math.min(focus - Math.floor(visible / HALF), count - visible))
  return { start, end: Math.min(count, start + visible) }
}

function isArrow(key: RemoteKey): boolean {
  return key !== RemoteKey.Enter && key !== RemoteKey.Back && key !== RemoteKey.Info
}
