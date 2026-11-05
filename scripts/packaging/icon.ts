import { MARK, PALETTE } from '../logo/mark.ts'
import {
  type Bounds,
  boundsOf,
  type Color,
  isInShape,
  type Point,
  type Shape,
} from '../logo/shapes.ts'
import { BYTES_PER_PIXEL, type Image } from './png.ts'

// The icon of the app: the mark of the logo (scripts/logo/mark.ts) on the dark background of the
// app, in a square with rounded corners. Every pixel is computed, so the same size always gives the
// same image.
const CORNER_RADIUS = 0.2
const OPAQUE = 255
// Samples per pixel along each axis: 4x4 of them smooth the edges.
const SAMPLES = 4
const HALF = 0.5
const NO_COLOR: Color = { red: 0, green: 0, blue: 0 }
const TRANSPARENT: readonly number[] = [0, 0, 0, 0]
const BACKGROUND: readonly number[] = [
  PALETTE.background.red,
  PALETTE.background.green,
  PALETTE.background.blue,
  OPAQUE,
]

// Where the samples fall inside a pixel, from its top left corner.
const OFFSETS: readonly number[] = [...new Array<undefined>(SAMPLES).keys()].map(
  (index) => (index + HALF) / SAMPLES,
)
const SAMPLE_POINTS: readonly Point[] = OFFSETS.flatMap((y) => OFFSETS.map((x) => ({ x, y })))

interface PlacedShape {
  readonly shape: Shape
  readonly bounds: Bounds
}

// The last shapes are painted over the first ones: the first found from the end wins. Most pixels
// lie outside the box of every shape, and need no sample at all.
const SHAPES_ON_TOP_FIRST: readonly PlacedShape[] = MARK.toReversed().map((shape) => ({
  shape,
  bounds: boundsOf([shape]),
}))

export function drawIcon(size: number): Image {
  const pixels = new Uint8Array(size * size * BYTES_PER_PIXEL)
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      pixels.set(pixelAt({ x: column, y: row }, size), (row * size + column) * BYTES_PER_PIXEL)
    }
  }
  return { width: size, height: size, pixels }
}

function pixelAt(corner: Point, size: number): readonly number[] {
  const box = {
    left: corner.x / size,
    top: corner.y / size,
    right: (corner.x + 1) / size,
    bottom: (corner.y + 1) / size,
  }
  const shapes = SHAPES_ON_TOP_FIRST.filter(({ bounds }) => overlaps(bounds, box)).map(
    ({ shape }) => shape,
  )
  if (shapes.length === 0 && isAwayFromTheCorners(box)) {
    return BACKGROUND
  }
  return sampled(corner, size, shapes)
}

// The average of the samples the square covers; the rest of the pixel is transparent.
function sampled(corner: Point, size: number, shapes: readonly Shape[]): readonly number[] {
  let sum = NO_COLOR
  let covered = 0
  for (const offset of SAMPLE_POINTS) {
    const color = colorAt(
      { x: (corner.x + offset.x) / size, y: (corner.y + offset.y) / size },
      shapes,
    )
    if (color !== undefined) {
      sum = {
        red: sum.red + color.red,
        green: sum.green + color.green,
        blue: sum.blue + color.blue,
      }
      covered += 1
    }
  }
  if (covered === 0) {
    return TRANSPARENT
  }
  const average = (channel: number): number => Math.round(channel / covered)
  const alpha = Math.round((OPAQUE * covered) / SAMPLE_POINTS.length)
  return [average(sum.red), average(sum.green), average(sum.blue), alpha]
}

function colorAt(point: Point, shapes: readonly Shape[]): Color | undefined {
  if (!isInRoundedSquare(point)) {
    return undefined
  }
  return shapes.find((shape) => isInShape(shape, point))?.color ?? PALETTE.background
}

function overlaps(first: Bounds, second: Bounds): boolean {
  const isAcrossColumns = first.left < second.right && first.right > second.left
  return isAcrossColumns && first.top < second.bottom && first.bottom > second.top
}

// Inside the square, between its straight edges: no rounded corner reaches the pixel.
function isAwayFromTheCorners({ left, top, right, bottom }: Bounds): boolean {
  const isInMiddleColumn = left >= CORNER_RADIUS && right <= 1 - CORNER_RADIUS
  return isInMiddleColumn || (top >= CORNER_RADIUS && bottom <= 1 - CORNER_RADIUS)
}

// Inside the square, and not past the circle of the corner it is nearest to.
function isInRoundedSquare({ x, y }: Point): boolean {
  const dx = x - Math.min(Math.max(x, CORNER_RADIUS), 1 - CORNER_RADIUS)
  const dy = y - Math.min(Math.max(y, CORNER_RADIUS), 1 - CORNER_RADIUS)
  return dx * dx + dy * dy <= CORNER_RADIUS * CORNER_RADIUS
}
