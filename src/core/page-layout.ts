import { areaOf, CONTENT, GAP, type Rect } from './book-geometry.ts'
import { firstOr, zipWith } from './lists.ts'
import {
  areasOf,
  type Arrangement,
  arrangementsOf,
  Cut,
  isLeaf,
  leafOf,
  type Placement,
  placementsOf,
  type Shape,
  signatureOf,
  splitOf,
} from './page-arrangement.ts'
import { randomSequence } from './shuffle.ts'

// The layout of one page as an optimization: every way to cut the page for its photos (or, past a
// few photos, the best halves found one by one, paired) is scored, and the lowest cost wins. The
// cost grows with the room the photos leave empty, with a photo far from the share of the page its
// weight asks for, and with a photo too small to see; a pinch of the seed tells close ones apart.

export interface PagePhoto {
  // Its width over its height.
  readonly aspectRatio: number
  // How much of the page it asks for, next to the others: 1 for every photo today.
  readonly weight: number
}

export interface PageCandidate {
  readonly signature: string
  // In page heights, in the order of the page: the box of each photo, and the photo, whole, in the
  // middle of it.
  readonly placements: readonly Placement[]
  readonly cost: number
}

export interface PageSearch {
  readonly best: PageCandidate
  // The next best, in order, each a different arrangement: what a page takes instead of the best
  // when the page before it has the same.
  readonly others: readonly PageCandidate[]
  // How many arrangements were scored: never more than MAX_TRIED, however many photos.
  readonly tried: number
}

// What bounds the time a page takes, the same on every TV: the arrangements of up to six photos
// (394) are all scored; past that, the halves of the page are laid out one by one and paired, and
// nothing is scored past MAX_TRIED.
export const MAX_TRIED = 2000
const ALL_UP_TO = 6
// How many of the best arrangements of each half are paired with those of the other.
const PAIRED = 6
// What pairing the halves scores, whatever the halves took: the pairs of four places to cut, each
// across or down, and the plain column.
const PLACES = 4
const CUTS = 2
const JOINS = PLACES * CUTS * PAIRED * PAIRED + 1
const OTHERS = 2

const BALANCE_WEIGHT = 0.6
const SMALL_WEIGHT = 2
// A photo under this share of the room is too small to see from the couch.
const SMALL_SHARE = 0.04
const SEED_WEIGHT = 0.06
const HALF = 0.5

interface Target {
  readonly aspects: readonly number[]
  // The share of the photos' area each one asks for, by its weight.
  readonly shares: readonly number[]
  readonly box: Rect
}

interface Search {
  readonly random: () => number
  // Counts one more arrangement scored, unless this many were already.
  readonly spend: (limit: number) => boolean
  readonly limit: number
}

interface Scored {
  readonly arrangement: Arrangement
  // Infinite when a photo gets no room.
  readonly cost: number
}

export function searchPage(photos: readonly [PagePhoto, ...PagePhoto[]], seed: number): PageSearch {
  const budget = budgetOf()
  const search: Search = { random: randomSequence(seed), spend: budget.spend, limit: MAX_TRIED }
  const target: Target = {
    aspects: photos.map((photo) => photo.aspectRatio),
    shares: sharesOf(photos.map((photo) => photo.weight)),
    box: CONTENT,
  }
  const ranked = distinct(scoredFor(target, search), 1 + OTHERS).map((scored) =>
    candidateOf(scored, target),
  )
  const best = firstOr(ranked, candidateOf(scoreOf(column(target.aspects), target, search), target))
  return { best, others: ranked.slice(1), tried: budget.spent() }
}

// Every arrangement the search may score, the best first; none where a photo gets no room.
function scoredFor(target: Target, search: Search): readonly Scored[] {
  const scored: Scored[] = []
  for (const arrangement of arrangementsFor(target, search)) {
    if (!search.spend(search.limit)) {
      break
    }
    scored.push(scoreOf(arrangement, target, search))
  }
  scored.sort((first, second) => first.cost - second.cost)
  return scored.filter(({ cost }) => Number.isFinite(cost))
}

function arrangementsFor(target: Target, search: Search): readonly Arrangement[] {
  return target.aspects.length <= ALL_UP_TO
    ? arrangementsOf(target.aspects, GAP)
    : halvesOf(target, search)
}

// In its own shape, as large as the room allows.
function scoreOf(arrangement: Arrangement, target: Target, search: Search): Scored {
  const box = naturalBox(arrangement.shape, target.box)
  const areas = areasOf(arrangement, box)
  const jitter = SEED_WEIGHT * search.random()
  const hasRoom = areas.every((area) => area > 0)
  return {
    arrangement,
    cost: hasRoom ? costOf(areas, target) + jitter : Number.POSITIVE_INFINITY,
  }
}

// The best of different arrangements, up to this many.
function distinct(scored: readonly Scored[], count: number): readonly Scored[] {
  const seen = new Set<string>()
  const kept: Scored[] = []
  for (const candidate of scored) {
    const signature = signatureOf(candidate.arrangement)
    if (!seen.has(signature)) {
      seen.add(signature)
      kept.push(candidate)
    }
    if (kept.length === count) {
      return kept
    }
  }
  return kept
}

function candidateOf({ arrangement, cost }: Scored, target: Target): PageCandidate {
  return {
    signature: signatureOf(arrangement),
    placements: placementsOf(arrangement, naturalBox(arrangement.shape, target.box), GAP),
    cost,
  }
}

// Past a few photos: the page cut in two near its middle, across or down; the best arrangements of
// each half in its part of the room, paired in every way; and every photo in one column, which
// always fits.
function halvesOf(target: Target, search: Search): readonly Arrangement[] {
  const count = target.aspects.length
  const low = Math.floor(count * HALF)
  const high = Math.ceil(count * HALF)
  const places = [...new Set([low, high, low - 1, high + 1])]
  const halves = { ...search, limit: search.limit - JOINS }
  const wholes = places.map((at) => [
    ...pairsOf(target, { at, cut: Cut.Row }, halves),
    ...pairsOf(target, { at, cut: Cut.Column }, halves),
  ])
  return [...([] as Arrangement[]).concat(...wholes), column(target.aspects)]
}

interface Halving {
  readonly at: number
  readonly cut: Cut
}

function pairsOf(target: Target, halving: Halving, search: Search): readonly Arrangement[] {
  const count = target.aspects.length
  const [firstBox, restBox] = boxesOf(target.box, halving.cut, halving.at / count)
  const firsts = bestParts(partOf(target, { start: 0, end: halving.at }, firstBox), search)
  const rests = bestParts(partOf(target, { start: halving.at, end: count }, restBox), search)
  const pairs = firsts.map((first) => rests.map((rest) => joined(halving.cut, [first, rest])))
  return ([] as Arrangement[]).concat(...pairs)
}

// When the search may score no more, a half is one column.
function bestParts(target: Target, search: Search): readonly Arrangement[] {
  const best = scoredFor(target, search)
    .slice(0, PAIRED)
    .map(({ arrangement }) => arrangement)
  return best.length === 0 ? [column(target.aspects)] : best
}

// Every photo in one column always fits.
function column(aspects: readonly number[]): Arrangement {
  const leaves = aspects.map(leafOf)
  const [single] = leaves
  return single !== undefined && leaves.length === 1 ? single : splitOf(Cut.Column, leaves, GAP)
}

// The photos of a run, in their part of the room, with their share of the run's area.
function partOf(
  target: Target,
  run: { readonly start: number; readonly end: number },
  box: Rect,
): Target {
  return {
    aspects: target.aspects.slice(run.start, run.end),
    shares: sharesOf(target.shares.slice(run.start, run.end)),
    box,
  }
}

// The room cut in two, across or down, the gap between them: this share of what is left for the
// first part. Only their sizes count to score their arrangements.
function boxesOf(box: Rect, cut: Cut, share: number): readonly [Rect, Rect] {
  const isRow = cut === Cut.Row
  const length = (isRow ? box.width : box.height) - GAP
  const [first, rest] = [length * share, length * (1 - share)]
  return isRow
    ? [
        { ...box, width: first },
        { ...box, width: rest },
      ]
    : [
        { ...box, height: first },
        { ...box, height: rest },
      ]
}

// Two halves cut the same way as the whole read as one: their parts join the whole's.
function joined(cut: Cut, halves: readonly Arrangement[]): Arrangement {
  const parts = halves.map((half) => (!isLeaf(half) && half.cut === cut ? half.parts : [half]))
  return splitOf(cut, ([] as Arrangement[]).concat(...parts), GAP)
}

// The room the photos leave empty, how far their shares of the area are from what their weights
// ask for (0 to 1), and how far the small ones are under a visible size.
function costOf(areas: readonly number[], target: Target): number {
  const total = sum(areas)
  const room = areaOf(target.box)
  const imbalance = sum(
    zipWith(areas, target.shares, (area, share) => Math.abs(area / total - share)),
  )
  const smallness = sum(areas.map((area) => Math.max(0, SMALL_SHARE - area / room)))
  return (
    1 - total / room + BALANCE_WEIGHT * HALF * imbalance + (SMALL_WEIGHT * smallness) / SMALL_SHARE
  )
}

// The arrangement as wide as the room, or as high when that is too high; in the middle of the room.
function naturalBox(shape: Shape, room: Rect): Rect {
  const height = shape.slope * room.width + shape.offset
  if (height <= room.height) {
    return { ...room, y: room.y + (room.height - height) * HALF, height }
  }
  const width = (room.height - shape.offset) / shape.slope
  return { ...room, x: room.x + (room.width - width) * HALF, width }
}

function sharesOf(weights: readonly number[]): readonly number[] {
  const total = sum(weights)
  return weights.map((weight) => weight / total)
}

// Counts the arrangements scored, against a limit each caller sets.
function budgetOf(): { readonly spend: (limit: number) => boolean; readonly spent: () => number } {
  let spent = 0
  return {
    spend: (limit) => {
      if (spent >= limit) {
        return false
      }
      spent += 1
      return true
    },
    spent: () => spent,
  }
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
