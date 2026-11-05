import { describe, expect, it } from 'vitest'

import { photos } from '../../test/library-stub.ts'
import {
  type FeedLayout,
  feedLayout,
  FeedRowKind,
  type FeedShape,
  moveInFeed,
  placeInFeed,
  renderedRows,
  rowOfPhoto,
  slotOfRow,
} from './feed-layout.ts'
import { START_POSITION } from './grid.ts'
import type { FeedMonth } from './photo-feed.ts'
import { RemoteKey } from './remote-key.ts'

const { Up, Down, Left, Right, Enter } = RemoteKey

const SHAPE: FeedShape = { columns: 3, screenHeight: 10, rowHeight: 3, headingHeight: 1 }

function feedMonth(key: string, count: number): FeedMonth {
  return { month: { key, year: 2024, month: 1, photoCount: count }, photos: photos(key, count) }
}

// Rows: 0 the heading of A; 1 photos 0-2; 2 photos 3-5; 3 photo 6; 4 the heading of B; 5 photos
// 7-8; (C has no photo) 6 the heading of D; 7 photos 9-11; 8 photo 12.
const MONTHS = [feedMonth('a', 7), feedMonth('b', 2), feedMonth('c', 0), feedMonth('d', 4)]
const LAYOUT: FeedLayout = feedLayout(MONTHS, SHAPE)

describe('feedLayout', () => {
  it('should open each month with its heading, then its photos a row at a time', () => {
    const sut = LAYOUT

    expect(
      sut.rows.map((row) => [
        row.kind,
        row.month.month.key,
        row.firstPhoto,
        row.photos.length,
        row.top,
        row.height,
      ]),
    ).toStrictEqual([
      [FeedRowKind.Heading, 'a', 0, 0, 0, 1],
      [FeedRowKind.Photos, 'a', 0, 3, 1, 3],
      [FeedRowKind.Photos, 'a', 3, 3, 4, 3],
      [FeedRowKind.Photos, 'a', 6, 1, 7, 3],
      [FeedRowKind.Heading, 'b', 7, 0, 10, 1],
      [FeedRowKind.Photos, 'b', 7, 2, 11, 3],
      [FeedRowKind.Heading, 'd', 9, 0, 14, 1],
      [FeedRowKind.Photos, 'd', 9, 3, 15, 3],
      [FeedRowKind.Photos, 'd', 12, 1, 18, 3],
    ])
    expect(sut.photoCount).toBe(13)
    expect(sut.rows[2]?.photos.map((photo) => photo.id)).toStrictEqual(['a-4', 'a-5', 'a-6'])
    expect(sut.rows[3]?.photos.map((photo) => photo.id)).toStrictEqual(['a-7'])
    expect(sut.shape).toBe(SHAPE)
  })

  it('should have no rows without photos', () => {
    expect(feedLayout([feedMonth('c', 0)], SHAPE)).toStrictEqual({
      shape: SHAPE,
      rows: [],
      photoCount: 0,
    })
  })
})

describe('rowOfPhoto', () => {
  it.each([
    [0, 1],
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
    [7, 5],
    [8, 5],
    [9, 7],
    [11, 7],
    [12, 8],
  ])('should find photo %i on row %i, never on a heading', (photo, row) => {
    expect(rowOfPhoto(LAYOUT.rows, photo)).toBe(row)
  })

  it('should give the first row of a feed without rows', () => {
    expect(rowOfPhoto([], 4)).toBe(0)
  })
})

describe('placeInFeed', () => {
  it('should start at the top of an empty feed', () => {
    expect(placeInFeed({ focus: 4, topRow: 2 }, feedLayout([], SHAPE))).toBe(START_POSITION)
  })

  it.each([
    [
      { focus: 99, topRow: 0 },
      { focus: 12, topRow: 5 },
    ],
    [
      { focus: -1, topRow: 3 },
      { focus: 0, topRow: 0 },
    ],
    [
      { focus: 3, topRow: 0 },
      { focus: 3, topRow: 0 },
    ],
    [
      { focus: 6, topRow: 0 },
      { focus: 6, topRow: 0 },
    ],
    [
      { focus: 3, topRow: 2 },
      { focus: 3, topRow: 2 },
    ],
    [
      { focus: 7, topRow: 5 },
      { focus: 7, topRow: 4 },
    ],
    [
      { focus: 7, topRow: 8 },
      { focus: 7, topRow: 4 },
    ],
    [
      { focus: 4, topRow: 3 },
      { focus: 4, topRow: 2 },
    ],
  ])('should place %j on %j', (position, placed) => {
    expect(placeInFeed(position, LAYOUT)).toStrictEqual(placed)
  })

  it('should show the focused row at the top when it is taller than the screen', () => {
    const layout = feedLayout(MONTHS, { ...SHAPE, screenHeight: 2 })

    expect(placeInFeed({ focus: 6, topRow: 0 }, layout)).toStrictEqual({ focus: 6, topRow: 3 })
  })
})

describe('moveInFeed', () => {
  it.each([
    { move: 'down', from: { focus: 0, topRow: 0 }, key: Down, to: { focus: 3, topRow: 0 } },
    {
      move: 'down to the last photo of a shorter row',
      from: { focus: 5, topRow: 0 },
      key: Down,
      to: { focus: 6, topRow: 0 },
    },
    {
      move: 'down past a heading, the rows going up',
      from: { focus: 6, topRow: 0 },
      key: Down,
      to: { focus: 7, topRow: 2 },
    },
    {
      move: 'down to a month that starts on the screen',
      from: { focus: 8, topRow: 2 },
      key: Down,
      to: { focus: 10, topRow: 4 },
    },
    {
      move: 'down from the last row nowhere',
      from: { focus: 12, topRow: 5 },
      key: Down,
      to: { focus: 12, topRow: 5 },
    },
    {
      move: 'up past a heading',
      from: { focus: 9, topRow: 4 },
      key: Up,
      to: { focus: 7, topRow: 4 },
    },
    {
      move: 'up above the screen',
      from: { focus: 7, topRow: 4 },
      key: Up,
      to: { focus: 6, topRow: 3 },
    },
    {
      move: 'up to the first row, with its heading',
      from: { focus: 4, topRow: 2 },
      key: Up,
      to: { focus: 1, topRow: 0 },
    },
    {
      move: 'up from the first row nowhere',
      from: { focus: 1, topRow: 0 },
      key: Up,
      to: { focus: 1, topRow: 0 },
    },
    {
      move: 'right to the next row',
      from: { focus: 2, topRow: 0 },
      key: Right,
      to: { focus: 3, topRow: 0 },
    },
    {
      move: 'right from the last photo nowhere',
      from: { focus: 12, topRow: 5 },
      key: Right,
      to: { focus: 12, topRow: 5 },
    },
    {
      move: 'left to the month before',
      from: { focus: 7, topRow: 4 },
      key: Left,
      to: { focus: 6, topRow: 3 },
    },
    {
      move: 'left from the first photo nowhere',
      from: { focus: 0, topRow: 0 },
      key: Left,
      to: { focus: 0, topRow: 0 },
    },
    {
      move: 'nowhere on Enter',
      from: { focus: 4, topRow: 0 },
      key: Enter,
      to: { focus: 4, topRow: 0 },
    },
  ])('should move $move', ({ from, key, to }) => {
    expect(moveInFeed(from, key, LAYOUT)).toStrictEqual(to)
  })

  it.each([Up, Down, Left, Right])('should stay at the top of an empty feed on %s', (key) => {
    expect(moveInFeed({ focus: 2, topRow: 1 }, key, feedLayout([], SHAPE))).toBe(START_POSITION)
  })
})

describe('renderedRows', () => {
  it('should render the rows on the screen and those within the buffer around it', () => {
    expect(renderedRows({ focus: 9, topRow: 4 }, LAYOUT, 3)).toStrictEqual({ start: 3, end: 9 })
    expect(renderedRows({ focus: 0, topRow: 0 }, LAYOUT, 4)).toStrictEqual({ start: 0, end: 6 })
    expect(renderedRows({ focus: 3, topRow: 2 }, LAYOUT, 0)).toStrictEqual({ start: 2, end: 6 })
  })

  it('should render nothing of an empty feed', () => {
    expect(renderedRows(START_POSITION, feedLayout([], SHAPE), 3)).toStrictEqual({
      start: 0,
      end: 0,
    })
  })
})

describe('slotOfRow', () => {
  it.each([
    [0, { focus: 0, topRow: 0 }, { top: 0, isOnScreen: true }],
    [3, { focus: 0, topRow: 0 }, { top: 7, isOnScreen: true }],
    [4, { focus: 0, topRow: 0 }, { top: 10, isOnScreen: false }],
    [3, { focus: 9, topRow: 4 }, { top: -3, isOnScreen: false }],
    [4, { focus: 9, topRow: 4 }, { top: 0, isOnScreen: true }],
    [8, { focus: 9, topRow: 4 }, { top: 8, isOnScreen: false }],
  ])('should place row %i, seen from %j, at %j', (row, position, slot) => {
    const [found] = LAYOUT.rows.slice(row, row + 1)
    if (found === undefined) {
      throw new RangeError(`No row ${String(row)}`)
    }

    expect(slotOfRow(found, position, LAYOUT)).toStrictEqual(slot)
  })
})
