import { describe, expect, it } from 'vitest'

import {
  type GridLayout,
  type GridPosition,
  moveInGrid,
  placeInGrid,
  renderedRange,
  slotOf,
  START_POSITION,
} from './grid.ts'
import { RemoteKey } from './remote-key.ts'

// 3 columns, 2 rows on the screen, 10 items: the last row has a single item.
//   0 1 2
//   3 4 5
//   6 7 8
//   9
const LAYOUT: GridLayout = { count: 10, columns: 3, visibleRows: 2 }

function at(focus: number, topRow = 0): GridPosition {
  return { focus, topRow }
}

function focusAfter(focus: number, key: RemoteKey, layout = LAYOUT): number {
  return moveInGrid(placeInGrid(at(focus), layout), key, layout).focus
}

describe('moveInGrid', () => {
  it.each([
    [4, RemoteKey.Left, 3],
    [4, RemoteKey.Right, 5],
    [4, RemoteKey.Up, 1],
    [4, RemoteKey.Down, 7],
  ])('should move the focus from %i on %s to %i', (focus, key, expected) => {
    expect(focusAfter(focus, key)).toBe(expected)
  })

  it.each([
    [3, RemoteKey.Left],
    [5, RemoteKey.Right],
    [1, RemoteKey.Up],
    [9, RemoteKey.Down],
    [9, RemoteKey.Right],
    [0, RemoteKey.Up],
  ])('should keep the focus on %i at the edge on %s', (focus, key) => {
    expect(focusAfter(focus, key)).toBe(focus)
  })

  it.each([6, 7, 8])('should go down from %i to the single item of the last row', (focus) => {
    expect(focusAfter(focus, RemoteKey.Down)).toBe(9)
  })

  it.each([RemoteKey.Enter, RemoteKey.Back])('should not move on %s', (key) => {
    expect(moveInGrid(at(4, 1), key, LAYOUT)).toStrictEqual(at(4, 1))
  })

  it('should walk a single column', () => {
    const column: GridLayout = { count: 3, columns: 1, visibleRows: 1 }

    expect(focusAfter(0, RemoteKey.Down, column)).toBe(1)
    expect(focusAfter(2, RemoteKey.Down, column)).toBe(2)
    expect(focusAfter(1, RemoteKey.Right, column)).toBe(1)
    expect(focusAfter(1, RemoteKey.Left, column)).toBe(1)
    expect(focusAfter(1, RemoteKey.Up, column)).toBe(0)
  })

  it('should walk a single row shorter than the grid', () => {
    const row: GridLayout = { count: 2, columns: 6, visibleRows: 3 }

    expect(focusAfter(0, RemoteKey.Right, row)).toBe(1)
    expect(focusAfter(1, RemoteKey.Right, row)).toBe(1)
    expect(focusAfter(1, RemoteKey.Down, row)).toBe(1)
    expect(focusAfter(1, RemoteKey.Up, row)).toBe(1)
  })

  it('should scroll down one row when the focus leaves the bottom of the screen', () => {
    expect(moveInGrid(at(4), RemoteKey.Down, LAYOUT)).toStrictEqual(at(7, 1))
  })

  it('should scroll up one row when the focus leaves the top of the screen', () => {
    expect(moveInGrid(at(4, 1), RemoteKey.Up, LAYOUT)).toStrictEqual(at(1, 0))
  })

  it('should not scroll while the focus stays on the screen', () => {
    expect(moveInGrid(at(7, 1), RemoteKey.Up, LAYOUT)).toStrictEqual(at(4, 1))
    expect(moveInGrid(at(1, 0), RemoteKey.Down, LAYOUT)).toStrictEqual(at(4, 0))
  })

  it('should stay put in an empty grid', () => {
    const empty: GridLayout = { count: 0, columns: 4, visibleRows: 2 }

    for (const key of Object.values(RemoteKey)) {
      expect(moveInGrid(START_POSITION, key, empty)).toStrictEqual(START_POSITION)
    }
  })
})

describe('placeInGrid', () => {
  it('should keep a position that fits', () => {
    expect(placeInGrid(at(7, 1), LAYOUT)).toStrictEqual(at(7, 1))
  })

  it('should bring a remembered focus beyond the last item back to the last item', () => {
    expect(placeInGrid(at(25, 7), LAYOUT)).toStrictEqual(at(9, 2))
  })

  it('should bring a negative focus or row back to the start', () => {
    expect(placeInGrid(at(-3, -2), LAYOUT)).toStrictEqual(START_POSITION)
  })

  it('should show the focus at the bottom of the screen when it starts below it', () => {
    expect(placeInGrid(at(8), LAYOUT)).toStrictEqual(at(8, 1))
  })

  it('should show the focus at the top of the screen when it starts above it', () => {
    expect(placeInGrid(at(1, 2), LAYOUT)).toStrictEqual(at(1, 0))
  })

  it('should never scroll past the last row', () => {
    expect(placeInGrid(at(9, 3), LAYOUT)).toStrictEqual(at(9, 2))
    expect(placeInGrid(at(5, 3), LAYOUT)).toStrictEqual(at(5, 1))
  })

  it('should not scroll a grid that fits on the screen', () => {
    const small: GridLayout = { count: 5, columns: 3, visibleRows: 3 }

    expect(placeInGrid(at(4, 1), small)).toStrictEqual(at(4, 0))
  })

  it('should start an empty grid at the start', () => {
    expect(placeInGrid(at(4, 2), { count: 0, columns: 3, visibleRows: 2 })).toStrictEqual(
      START_POSITION,
    )
  })
})

describe('renderedRange', () => {
  const LONG: GridLayout = { count: 60, columns: 4, visibleRows: 3 }

  it('should render the rows on the screen and the buffer rows around them', () => {
    expect(renderedRange(at(20, 5), LONG, 1)).toStrictEqual({ start: 16, end: 36 })
  })

  it('should render only the rows on the screen without a buffer', () => {
    expect(renderedRange(at(20, 5), LONG, 0)).toStrictEqual({ start: 20, end: 32 })
  })

  it('should not render rows before the first one', () => {
    expect(renderedRange(at(0, 0), LONG, 2)).toStrictEqual({ start: 0, end: 20 })
  })

  it('should not render items after the last one', () => {
    expect(renderedRange(at(59, 12), LONG, 1)).toStrictEqual({ start: 44, end: 60 })
  })

  it('should render nothing for an empty grid', () => {
    expect(
      renderedRange(START_POSITION, { count: 0, columns: 4, visibleRows: 3 }, 1),
    ).toStrictEqual({ start: 0, end: 0 })
  })

  it('should never render more than the visible and buffer rows', () => {
    const range = renderedRange(at(200, 40), { count: 1000, columns: 6, visibleRows: 3 }, 1)

    expect(range.end - range.start).toBe(30)
  })
})

describe('slotOf', () => {
  it.each([
    [3, { column: 0, row: 0, isOnScreen: true }],
    [7, { column: 1, row: 1, isOnScreen: true }],
  ])('should place the item %i on the screen by its column and row', (index, slot) => {
    expect(slotOf(index, at(7, 1), LAYOUT)).toStrictEqual(slot)
  })

  it('should place an item above the screen on a negative row, off the screen', () => {
    expect(slotOf(2, at(7, 1), LAYOUT)).toStrictEqual({ column: 2, row: -1, isOnScreen: false })
  })

  it('should place an item below the screen off the screen', () => {
    expect(slotOf(9, at(7, 1), LAYOUT)).toStrictEqual({ column: 0, row: 2, isOnScreen: false })
  })
})
