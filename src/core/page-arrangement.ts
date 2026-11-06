import { fitInside, type Rect } from './book-geometry.ts'

// How the photos of a page share it: a guillotine cut, again and again. A part of the page is either
// one photo, or a row of parts side by side (cut across), or a column of parts one above the other
// (cut down); the parts of a row are columns or photos, and those of a column are rows or photos.
// Read left to right and top to bottom, the photos come in the order of the book.
export const Cut = {
  Row: 'row',
  Column: 'column',
} as const

export type Cut = (typeof Cut)[keyof typeof Cut]

// At a given width, an arrangement whose photos all keep their shape is exactly this high:
// slope * width + offset (the gaps between the photos make the offset).
export interface Shape {
  readonly slope: number
  readonly offset: number
}

export type Arrangement = Leaf | Split

// A photo, by its width over its height: the photos of an arrangement come in the order of its
// parts, left to right and top to bottom.
export interface Leaf {
  readonly aspect: number
  readonly shape: Shape
}

// Two parts or more, and the shape they make with the gaps between them.
export interface Split {
  readonly cut: Cut
  readonly parts: readonly Arrangement[]
  readonly shape: Shape
}

export interface Size {
  readonly width: number
  readonly height: number
}

// A photo on the page: its box, and the photo, whole, in the middle of it.
export interface Placement {
  readonly cell: Rect
  readonly photo: Rect
}

interface Span {
  readonly start: number
  readonly end: number
}

export function leafOf(aspect: number): Leaf {
  return { aspect, shape: { slope: 1 / aspect, offset: 0 } }
}

// A photo keeps its shape: as high as its width over its aspect. A row shares one height, so its
// widths add up; a column shares one width, so its heights do.
export function splitOf(cut: Cut, parts: readonly Arrangement[], gap: number): Split {
  const shapes = parts.map(({ shape }) => shape)
  const gaps = gap * (shapes.length - 1)
  if (cut === Cut.Column) {
    const slope = sum(shapes.map((shape) => shape.slope))
    return { cut, parts, shape: { slope, offset: sum(shapes.map(({ offset }) => offset)) + gaps } }
  }
  const slope = 1 / sum(shapes.map((shape) => 1 / shape.slope))
  const offset = (sum(shapes.map((shape) => shape.offset / shape.slope)) - gaps) * slope
  return { cut, parts, shape: { slope, offset } }
}

// Every arrangement of these photos, each once, in their order: 1, 2, 6, 22, 90, 394, 1806... of
// them for 1, 2, 3... photos (the large Schröder numbers). The arrangements of the same photos
// share their parts.
export function arrangementsOf(aspects: readonly number[], gap: number): readonly Arrangement[] {
  const leaves = aspects.map(leafOf)
  if (leaves.length === 1) {
    return leaves
  }
  const enumeration = { leaves, gap, known: new Map<string, readonly Arrangement[]>() }
  const all = { start: 0, end: leaves.length }
  return [...splitsOf(enumeration, all, Cut.Row), ...splitsOf(enumeration, all, Cut.Column)]
}

export function isLeaf(arrangement: Arrangement): arrangement is Leaf {
  return 'aspect' in arrangement
}

// How it reads, whatever the photos: "row(1,column(1,1))".
export function signatureOf(arrangement: Arrangement): string {
  if (isLeaf(arrangement)) {
    return '1'
  }
  return `${arrangement.cut}(${arrangement.parts.map(signatureOf).join(',')})`
}

// Where each photo goes, in the order of the page, when the arrangement fills this box: a box of
// the arrangement's own shape, so that each photo fills its own and the gaps stay the same.
export function placementsOf(
  arrangement: Arrangement,
  box: Rect,
  gap: number,
): readonly Placement[] {
  if (isLeaf(arrangement)) {
    return [{ cell: box, photo: fitInside(arrangement.aspect, box) }]
  }
  const placements: Placement[] = []
  let rest = box
  for (const part of arrangement.parts) {
    const partBox = boxOf(part.shape, { box: rest, cut: arrangement.cut })
    placements.push(...placementsOf(part, partBox, gap))
    rest = afterBox(rest, partBox, { cut: arrangement.cut, gap })
  }
  return placements
}

// The area of each photo, in the order of the page, when the arrangement fills a box of this size
// in its own shape; 0 for a photo that gets no room at all (a column of many photos in a very wide
// row). The same as the placements give, without placing anything.
export function areasOf(arrangement: Arrangement, size: Size): readonly number[] {
  const areas: number[] = []
  addAreas(arrangement, size, areas)
  return areas
}

// Scoring a page measures thousands of arrangements: this adds to one list instead of joining many.
function addAreas(arrangement: Arrangement, size: Size, areas: number[]): void {
  if (isLeaf(arrangement)) {
    areas.push(Math.max(0, size.width) * Math.max(0, size.height))
    return
  }
  for (const part of arrangement.parts) {
    addAreas(part, partSizeOf(part.shape, { size, cut: arrangement.cut }), areas)
  }
}

// A part of a row is as high as the row, and as wide as its shape makes it; a part of a column is
// as wide as the column.
function partSizeOf(
  { slope, offset }: Shape,
  within: { readonly size: Size; readonly cut: Cut },
): Size {
  const { size } = within
  return within.cut === Cut.Row
    ? { width: (size.height - offset) / slope, height: size.height }
    : { width: size.width, height: slope * size.width + offset }
}

// The first box of what is left of a row or a column, as wide (or as high) as the part's shape.
function boxOf(shape: Shape, cutting: { readonly box: Rect; readonly cut: Cut }): Rect {
  return { ...cutting.box, ...partSizeOf(shape, { size: cutting.box, cut: cutting.cut }) }
}

// Where the next part of a row or a column starts, after a part and the gap after it: each part
// takes the size its shape gives it.
function afterBox(
  rest: Rect,
  part: Rect,
  cutting: { readonly cut: Cut; readonly gap: number },
): Rect {
  return cutting.cut === Cut.Row
    ? { ...rest, x: part.x + part.width + cutting.gap }
    : { ...rest, y: part.y + part.height + cutting.gap }
}

interface Enumeration {
  readonly leaves: readonly Leaf[]
  readonly gap: number
  // The arrangements of a span cut one way, by "start end cut".
  readonly known: Map<string, readonly Arrangement[]>
}

// The parts of a span cut one way: every way to cut it in two or more runs, each run a photo or an
// arrangement cut the other way.
function splitsOf(enumeration: Enumeration, span: Span, cut: Cut): readonly Arrangement[] {
  const key = `${String(span.start)} ${String(span.end)} ${cut}`
  const known = enumeration.known.get(key)
  if (known !== undefined) {
    return known
  }
  const across = cut === Cut.Row ? Cut.Column : Cut.Row
  const splits = flatten(
    runsOf(span).map((runs) =>
      combinations(runs.map((run) => partsOf(enumeration, run, across))).map((parts) =>
        splitOf(cut, parts, enumeration.gap),
      ),
    ),
  )
  enumeration.known.set(key, splits)
  return splits
}

function partsOf(enumeration: Enumeration, run: Span, cut: Cut): readonly Arrangement[] {
  return run.end - run.start === 1
    ? enumeration.leaves.slice(run.start, run.end)
    : splitsOf(enumeration, run, cut)
}

// Every way to cut the span in two or more runs of photos that follow each other.
function runsOf(span: Span): readonly (readonly Span[])[] {
  const ways: (readonly Span[])[] = []
  for (let end = span.start + 1; end < span.end; end += 1) {
    const first = { start: span.start, end }
    const rest = { start: end, end: span.end }
    ways.push([first, rest], ...runsOf(rest).map((runs) => [first, ...runs]))
  }
  return ways
}

// One choice from each list, in every way.
function combinations<T>(choices: readonly (readonly T[])[]): readonly (readonly T[])[] {
  return choices.reduce<readonly (readonly T[])[]>(
    (chosen, options) =>
      flatten(chosen.map((before) => options.map((option) => [...before, option]))),
    [[]],
  )
}

// Array.prototype.flat is newer than Chromium 68.
function flatten<T>(lists: readonly (readonly T[])[]): readonly T[] {
  return ([] as T[]).concat(...lists)
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
