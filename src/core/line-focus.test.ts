import { describe, expect, it } from 'vitest'

import { Axis, leavesGridUp, leavesLine, lineWindow, moveInLine } from './line-focus.ts'
import { RemoteKey } from './remote-key.ts'

const { Up, Down, Left, Right, Enter, Back, Info } = RemoteKey
const BAR = { count: 3, axis: Axis.Row }
const MENU = { count: 4, axis: Axis.Column }

describe('moveInLine', () => {
  it('should go along a bar with left and right, and stop at its ends', () => {
    expect(moveInLine(0, Right, BAR)).toBe(1)
    expect(moveInLine(1, Left, BAR)).toBe(0)
    expect(moveInLine(0, Left, BAR)).toBe(0)
    expect(moveInLine(2, Right, BAR)).toBe(2)
    expect(moveInLine(1, Up, BAR)).toBe(1)
    expect(moveInLine(1, Down, BAR)).toBe(1)
  })

  it('should go along a menu with up and down, and stop at its ends', () => {
    expect(moveInLine(0, Down, MENU)).toBe(1)
    expect(moveInLine(2, Up, MENU)).toBe(1)
    expect(moveInLine(0, Up, MENU)).toBe(0)
    expect(moveInLine(3, Down, MENU)).toBe(3)
    expect(moveInLine(1, Left, MENU)).toBe(1)
    expect(moveInLine(1, Enter, MENU)).toBe(1)
  })

  it('should keep a focus past the end on the last item', () => {
    expect(moveInLine(5, Info, MENU)).toBe(3)
  })
})

describe('leavesLine', () => {
  it('should leave a bar across it, or past its ends', () => {
    expect(leavesLine(1, Down, BAR)).toBe(true)
    expect(leavesLine(1, Up, BAR)).toBe(true)
    expect(leavesLine(0, Left, BAR)).toBe(true)
    expect(leavesLine(2, Right, BAR)).toBe(true)
    expect(leavesLine(1, Right, BAR)).toBe(false)
  })

  it('should never leave on Enter, Back or Info', () => {
    expect(leavesLine(0, Enter, BAR)).toBe(false)
    expect(leavesLine(0, Back, BAR)).toBe(false)
    expect(leavesLine(0, Info, BAR)).toBe(false)
  })
})

describe('leavesGridUp', () => {
  it('should leave the grid on Up from its first row, where the focus stays', () => {
    const at = { focus: 2, topRow: 0 }

    expect(leavesGridUp(Up, at, at)).toBe(true)
    expect(leavesGridUp(Up, { focus: 8, topRow: 0 }, at)).toBe(false)
    expect(leavesGridUp(Left, at, at)).toBe(false)
  })
})

describe('lineWindow', () => {
  it('should show a short menu whole', () => {
    expect(lineWindow(2, 4, 7)).toStrictEqual({ start: 0, end: 4 })
  })

  it('should keep the focus in the middle of a long menu', () => {
    expect(lineWindow(10, 40, 7)).toStrictEqual({ start: 7, end: 14 })
    expect(lineWindow(11, 40, 6)).toStrictEqual({ start: 8, end: 14 })
  })

  it('should not move past either end', () => {
    expect(lineWindow(1, 40, 7)).toStrictEqual({ start: 0, end: 7 })
    expect(lineWindow(39, 40, 7)).toStrictEqual({ start: 33, end: 40 })
  })
})
