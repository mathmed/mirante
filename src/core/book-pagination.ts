import { randomSequence } from './shuffle.ts'

// How many photos each page of a book takes, decided for the whole book at once, cheaply, before
// any page is laid out. The book breathes: in each spread one page holds a few photos and the other
// is full, the seed deciding which side; a panorama counts as two photos; and a portrait at the end
// of a page brings the next portrait along, so that the two stand side by side.

export const BookDensity = {
  Light: 'light',
  Normal: 'normal',
  Dense: 'dense',
} as const

export type BookDensity = (typeof BookDensity)[keyof typeof BookDensity]

// The photos a page takes: from fewest to most, and where a full page starts.
interface PageRange {
  readonly fewest: number
  readonly full: number
  readonly most: number
}

const RANGES: ReadonlyMap<BookDensity, PageRange> = new Map([
  [BookDensity.Light, { fewest: 1, full: 2, most: 3 }],
  [BookDensity.Normal, { fewest: 1, full: 3, most: 6 }],
  [BookDensity.Dense, { fewest: 3, full: 5, most: 9 }],
])

// Wider than this, a photo is a panorama, and takes the room of two.
const PANORAMA = 2
const PANORAMA_LOAD = 2
const COIN = 0.5
// The pages of a spread: the left one, then the right one.
const SIDES = 2

// All the pages need of a photo: its width over its height.
interface Shaped {
  readonly aspectRatio: number
}

export interface Pagination {
  readonly density: BookDensity
  readonly seed: number
  // The cover takes the left page of the first spread.
  readonly hasCover: boolean
}

export type PageOfPhotos<T extends Shaped> = readonly [T, ...T[]]

// The photos, in their order, page by page; the last page may hold fewer.
export function paginate<T extends Shaped>(
  photos: readonly T[],
  pagination: Pagination,
): readonly PageOfPhotos<T>[] {
  const range = rangeOf(pagination.density)
  const nextLoad = rhythmOf(pagination, range)
  const queue = [...photos]
  const pages: PageOfPhotos<T>[] = []
  for (let first = queue.shift(); first !== undefined; first = queue.shift()) {
    const taking = { load: nextLoad() - loadOf(first), room: range.most - 1, last: first }
    pages.push([first, ...taken(queue, taking)])
  }
  return pages
}

// What each page takes, page after page: a coin for each spread says which side breathes.
function rhythmOf(pagination: Pagination, range: PageRange): () => number {
  const random = randomSequence(pagination.seed)
  let side = pagination.hasCover ? 1 : 0
  let isLeftBreathing = random() < COIN
  return () => {
    const isLeft = side % SIDES === 0
    isLeftBreathing = isLeft ? random() < COIN : isLeftBreathing
    side += 1
    const draw = random()
    return isLeft === isLeftBreathing ? breathingLoad(range, draw) : fullLoad(range, draw)
  }
}

export function rangeOf(density: BookDensity): PageRange {
  const range = RANGES.get(density)
  if (range === undefined) {
    throw new RangeError(`No density "${density}"`)
  }
  return range
}

// A page of few photos, under a full one.
function breathingLoad(range: PageRange, draw: number): number {
  return range.fewest + Math.floor(draw * (range.full - range.fewest))
}

function fullLoad(range: PageRange, draw: number): number {
  return range.full + Math.floor(draw * (range.most - range.full + 1))
}

interface Taking<T> {
  // What the page still takes, counting a panorama twice.
  readonly load: number
  // How many more photos fit at most.
  readonly room: number
  readonly last: T
}

// The photos the page takes after its first, out of the queue.
function taken<T extends Shaped>(queue: T[], taking: Taking<T>): readonly T[] {
  const [next] = queue
  if (next === undefined || taking.room === 0) {
    return []
  }
  if (loadOf(next) > taking.load + pairAllowance(taking.last, next)) {
    return []
  }
  queue.shift()
  const after = { load: taking.load - loadOf(next), room: taking.room - 1, last: next }
  return [next, ...taken(queue, after)]
}

// Two portraits stand side by side: a full page still takes the second, once.
function pairAllowance(last: Shaped, next: Shaped): number {
  return isPortrait(last) && isPortrait(next) ? 1 : 0
}

function loadOf(photo: Shaped): number {
  return photo.aspectRatio >= PANORAMA ? PANORAMA_LOAD : 1
}

function isPortrait(photo: Shaped): boolean {
  return photo.aspectRatio < 1
}
