import type { Rect } from './book-geometry.ts'
import { RemoteKey } from './remote-key.ts'

// Where up and down take the focus among the photos of a spread, on the screen: the photo nearest
// that way, as long as each press goes on in the order of the spread (left page first, each page
// read left to right and top to bottom) and every photo can be reached; else the next photo in
// that order, or the one before.

// How far ahead a box is that way (negative when it is not ahead at all), how far off to the side
// of the way, and which way the order of the spread goes.
interface Way {
  readonly ahead: (from: Rect, to: Rect) => number
  readonly aside: (from: Rect, to: Rect) => number
  readonly step: number
}

const HALF = 0.5

const WAYS: ReadonlyMap<RemoteKey, Way> = new Map([
  [
    RemoteKey.Down,
    { ahead: (from: Rect, to: Rect) => to.y - bottom(from), aside: offAcross, step: 1 },
  ],
  [
    RemoteKey.Up,
    { ahead: (from: Rect, to: Rect) => from.y - bottom(to), aside: offAcross, step: -1 },
  ],
])

// Being off to the side counts more than being further ahead: the photo in line comes first.
const ASIDE_WEIGHT = 2
// Photos never overlap: one that starts where this one ends is ahead.
const TOUCHING = -1e-9

// The photo Down reaches: the nearest one below among those after it, or else the next one; none
// from the last. Up the same way, above and before. Each press goes on in the order of the spread,
// so Down always ends on the last photo, and Up on the first. When the photos nearest that way
// would leave one out of reach (beside the others, where only left and right would go, and they
// turn the page), up and down follow the order of the spread instead.
export function frameToward(
  frames: readonly Rect[],
  frame: number,
  key: RemoteKey,
): number | undefined {
  const way = WAYS.get(key)
  const [from] = frames.slice(frame, frame + 1)
  if (way === undefined || from === undefined || frame < 0) {
    return undefined
  }
  return isEveryFrameReached(frames)
    ? nearestToward(frames, { from, index: frame }, way)
    : nextInOrder(frames, frame + way.step)
}

// A photo of the spread, and its place there.
interface Placed {
  readonly from: Rect
  readonly index: number
}

interface Candidate {
  readonly index: number
  readonly distance: number
  readonly offset: number
  // How far its middle is from the middle of the photo in focus, across: of two photos as near,
  // the one more in line.
  readonly centering: number
}

function nearestToward(frames: readonly Rect[], placed: Placed, way: Way): number | undefined {
  const { from, index: frame } = placed
  const ahead = frames
    .map((to, index): Candidate => ({
      index,
      distance: way.ahead(from, to),
      offset: way.aside(from, to),
      centering: Math.abs(middleAcross(to) - middleAcross(from)),
    }))
    .filter(({ index, distance }) => way.step * (index - frame) > 0 && distance >= TOUCHING)
  ahead.sort(compared)
  return ahead[0]?.index ?? nextInOrder(frames, frame + way.step)
}

function compared(first: Candidate, second: Candidate): number {
  const byScore = scoreOf(first) - scoreOf(second)
  return byScore === 0 ? first.centering - second.centering : byScore
}

function scoreOf({ distance, offset }: Candidate): number {
  return distance + ASIDE_WEIGHT * offset
}

// Whether up and down, the nearest way, reach every photo from the first one: what they reach
// grows until it stops growing.
function isEveryFrameReached(frames: readonly Rect[]): boolean {
  const reached = new Set([0])
  for (let size = 0; size !== reached.size;) {
    size = reached.size
    frames
      .map((from, index): Placed => ({ from, index }))
      .filter(({ index }) => reached.has(index))
      .forEach((placed) => {
        stepsFrom(frames, placed).forEach((next) => reached.add(next))
      })
  }
  return reached.size >= frames.length
}

// The photos up and down reach from this one, the nearest way.
function stepsFrom(frames: readonly Rect[], placed: Placed): readonly number[] {
  return [...WAYS.values()]
    .map((way) => nearestToward(frames, placed, way))
    .filter((next): next is number => next !== undefined)
}

function nextInOrder(frames: readonly Rect[], frame: number): number | undefined {
  return frame >= 0 && frame < frames.length ? frame : undefined
}

interface Span {
  readonly start: number
  readonly end: number
}

// How far apart two spans are: 0 when they overlap.
function apart(one: Span, other: Span): number {
  return Math.max(0, other.start - one.end, one.start - other.end)
}

function offAcross(from: Rect, to: Rect): number {
  return apart({ start: from.x, end: right(from) }, { start: to.x, end: right(to) })
}

function middleAcross(rect: Rect): number {
  return rect.x + rect.width * HALF
}

function right(rect: Rect): number {
  return rect.x + rect.width
}

function bottom(rect: Rect): number {
  return rect.y + rect.height
}
