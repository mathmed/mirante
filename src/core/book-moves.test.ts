import { describe, expect, it } from 'vitest'

import { BOOK_OPTIONS, mixedPhotos, PAGE_SHAPES } from '../../test/book-photos.ts'
import type { Rect } from './book-geometry.ts'
import { frameToward } from './book-moves.ts'
import { spreadRects } from './book-navigation.ts'
import { bookLayouts, planBook } from './book.ts'
import { RemoteKey } from './remote-key.ts'

const { Up, Down, Right, Enter } = RemoteKey

// Two pages side by side, in page heights: on the left a large photo and two small ones under
// it; on the right two photos side by side.
//   +-------+-------+   +---+---+
//   |   0           |   | 3 | 4 |
//   +---+---+-------+   +---+---+
//   | 1 | 2 |
const FRAMES: readonly Rect[] = [
  { x: 0.1, y: 0.1, width: 1, height: 0.5 },
  { x: 0.1, y: 0.65, width: 0.45, height: 0.3 },
  { x: 0.65, y: 0.65, width: 0.45, height: 0.3 },
  { x: 1.5, y: 0.2, width: 0.5, height: 0.6 },
  { x: 2.1, y: 0.2, width: 0.5, height: 0.6 },
]

describe('frameToward', () => {
  it.each([
    [0, Down, 1],
    [1, Down, 2],
    [2, Down, 3],
    [3, Down, 4],
    [4, Up, 3],
    [3, Up, 2],
    [2, Up, 0],
    [1, Up, 0],
  ])('should go from photo %i, %s, to photo %i', (from, key, to) => {
    expect(frameToward(FRAMES, from, key)).toBe(to)
  })

  it('should find no photo below the last one, nor above the first one', () => {
    expect(frameToward(FRAMES, 4, Down)).toBeUndefined()
    expect(frameToward(FRAMES, 0, Up)).toBeUndefined()
  })

  it('should prefer the photo in line below to a nearer one off to the side', () => {
    const frames: readonly Rect[] = [
      { x: 0.4, y: 0, width: 0.2, height: 0.2 },
      { x: 0, y: 0.3, width: 0.1, height: 0.1 },
      { x: 0.45, y: 0.6, width: 0.1, height: 0.2 },
      { x: 0, y: 0.9, width: 0.1, height: 0.1 },
    ]

    expect(frameToward(frames, 0, Down)).toBe(2)
    expect(frameToward(frames, 3, Up)).toBe(1)
    expect(frameToward(frames, 2, Up)).toBe(0)
  })

  it('should follow the order of the spread when the nearest way would leave a photo out', () => {
    // A wide photo on top; under it a tall one, and two side by side over a wide one: the nearest
    // way, 2 and 3 both lead to 4 and 0, and 4 back to 2, never to 3.
    //   +---------------+
    //   |       0       |
    //   +---+ +---+ +---+
    //   | 1 | | 2 | | 3 |
    //   |   | +---+-+---+
    //   |   | |    4    |
    const frames: readonly Rect[] = [
      { x: 0, y: 0, width: 1, height: 0.3 },
      { x: 0, y: 0.4, width: 0.3, height: 0.6 },
      { x: 0.4, y: 0.4, width: 0.25, height: 0.2 },
      { x: 0.7, y: 0.4, width: 0.3, height: 0.2 },
      { x: 0.4, y: 0.7, width: 0.6, height: 0.3 },
    ]

    expect([0, 1, 2, 3].map((frame) => frameToward(frames, frame, Down))).toStrictEqual([
      1, 2, 3, 4,
    ])
    expect([4, 3, 2, 1].map((frame) => frameToward(frames, frame, Up))).toStrictEqual([3, 2, 1, 0])
  })

  it('should take, of two photos as near, the one more in line', () => {
    // Two rows of two; the bottom left photo is wider, and reaches under the top right one too.
    const frames: readonly Rect[] = [
      { x: 0, y: 0, width: 0.4, height: 0.3 },
      { x: 0.5, y: 0, width: 0.5, height: 0.3 },
      { x: 0, y: 0.4, width: 0.7, height: 0.3 },
      { x: 0.8, y: 0.4, width: 0.2, height: 0.3 },
    ]

    expect(frameToward(frames, 1, Down)).toBe(3)
    expect(frameToward(frames, 0, Down)).toBe(2)
    expect(frameToward(frames, 3, Up)).toBe(1)
    expect(frameToward(frames, 2, Up)).toBe(0)
  })

  it('should never go back in the order of the spread', () => {
    const frames: readonly Rect[] = [
      { x: 0, y: 0.7, width: 1, height: 0.2 },
      { x: 0, y: 0, width: 1, height: 0.2 },
    ]

    expect(frameToward(frames, 1, Down)).toBeUndefined()
    expect(frameToward(frames, 0, Up)).toBeUndefined()
  })

  it('should take a photo that overlaps this one by a rounding error as below', () => {
    const frames: readonly Rect[] = [
      { x: 0, y: -0.5, width: 1, height: 0.5 },
      { x: 0, y: -1e-9, width: 1, height: 0.5 },
    ]

    expect(frameToward(frames, 0, Down)).toBe(1)
    expect(frameToward(frames, 1, Up)).toBe(0)
  })

  it('should take a photo that starts where this one ends as below, and as above', () => {
    const frames: readonly Rect[] = [
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 1, height: 0.5 },
    ]

    expect(frameToward(frames, 0, Down)).toBe(1)
    expect(frameToward(frames, 1, Up)).toBe(0)
  })

  it('should find nothing from a photo that is not there, or for a key that does not move', () => {
    expect(frameToward(FRAMES, 9, Down)).toBeUndefined()
    expect(frameToward(FRAMES, -2, Down)).toBeUndefined()
    expect(frameToward(FRAMES, 0, Right)).toBeUndefined()
    expect(frameToward(FRAMES, 0, Enter)).toBeUndefined()
  })

  // The photos Down (or Up) reaches from one, press after press.
  function walk(frames: readonly Rect[], from: number, key: RemoteKey): readonly number[] {
    const visited = [from]
    for (let next = frameToward(frames, from, key); next !== undefined;) {
      visited.push(next)
      next = frameToward(frames, next, key)
    }
    return visited
  }

  // Every photo up and down reach, one press at a time, from the first one.
  function reachable(frames: readonly Rect[]): ReadonlySet<number> {
    const reached = new Set([0])
    const queue = [0]
    for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
      const steps = [frameToward(frames, at, Down), frameToward(frames, at, Up)]
      const fresh = steps.filter((next): next is number => next !== undefined && !reached.has(next))
      fresh.forEach((next) => reached.add(next))
      queue.push(...fresh)
    }
    return reached
  }

  it.each(PAGE_SHAPES)(
    'should go on in order to the last photo with Down, back to the first with Up, and reach every photo (pages of aspect %d)',
    (pageAspect) => {
      const book = planBook(mixedPhotos(160, 'p', 5), { ...BOOK_OPTIONS, pageAspect })
      const layouts = bookLayouts(book)

      for (const spread of book.spreads) {
        const frames = spreadRects(spread, layouts)
        const down = walk(frames, 0, Down)
        const up = walk(frames, frames.length - 1, Up)
        expect(down).toStrictEqual([...down].sort((one, other) => one - other))
        expect(down[down.length - 1]).toBe(frames.length - 1)
        expect(up).toStrictEqual([...up].sort((one, other) => other - one))
        expect(up[up.length - 1]).toBe(0)
        expect(reachable(frames).size).toBe(frames.length)
      }
    },
  )
})
