import { BYTES_PER_PIXEL, type Image } from './png.ts'

// The icon of the app, drawn from its shapes on a square of side 1 (y grows downwards): the dark
// background of the app with rounded corners, and an M in the yellow of its focus ring
// (src/ui/styles.css). Every pixel is computed, so the same size always gives the same image.
interface Point {
  readonly x: number
  readonly y: number
}

type Polygon = readonly [Point, ...Point[]]
interface Color {
  readonly red: number
  readonly green: number
  readonly blue: number
}

const BACKGROUND: Color = { red: 0x10, green: 0x14, blue: 0x18 }
const LETTER: Color = { red: 0xff, green: 0xd1, blue: 0x66 }
const NO_COLOR: Color = { red: 0, green: 0, blue: 0 }
const CORNER_RADIUS = 0.2
const OPAQUE = 255
// Samples per pixel along each axis: 4x4 of them smooth the edges.
const SAMPLES = 4
const HALF = 0.5

const M: Polygon = [
  { x: 0.22, y: 0.75 },
  { x: 0.22, y: 0.25 },
  { x: 0.35, y: 0.25 },
  { x: 0.5, y: 0.47 },
  { x: 0.65, y: 0.25 },
  { x: 0.78, y: 0.25 },
  { x: 0.78, y: 0.75 },
  { x: 0.65, y: 0.75 },
  { x: 0.65, y: 0.46 },
  { x: 0.5, y: 0.66 },
  { x: 0.35, y: 0.46 },
  { x: 0.35, y: 0.75 },
]

// Where the samples fall inside a pixel, from its top left corner.
const OFFSETS: readonly number[] = [...new Array<undefined>(SAMPLES).keys()].map(
  (index) => (index + HALF) / SAMPLES,
)
const SAMPLE_POINTS: readonly Point[] = OFFSETS.flatMap((y) => OFFSETS.map((x) => ({ x, y })))

export function drawIcon(size: number): Image {
  const pixels = new Uint8Array(size * size * BYTES_PER_PIXEL)
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      pixels.set(pixelAt({ x: column, y: row }, size), (row * size + column) * BYTES_PER_PIXEL)
    }
  }
  return { width: size, height: size, pixels }
}

// The average of the samples the shapes cover; the rest of the pixel is transparent.
function pixelAt(corner: Point, size: number): readonly number[] {
  const colors = SAMPLE_POINTS.map((offset) =>
    colorAt({ x: (corner.x + offset.x) / size, y: (corner.y + offset.y) / size }),
  ).filter((color) => color !== undefined)
  if (colors.length === 0) {
    return [0, 0, 0, 0]
  }
  const sum = colors.reduce<Color>(
    (total, color) => ({
      red: total.red + color.red,
      green: total.green + color.green,
      blue: total.blue + color.blue,
    }),
    NO_COLOR,
  )
  const average = (channel: number): number => Math.round(channel / colors.length)
  const alpha = Math.round((OPAQUE * colors.length) / SAMPLE_POINTS.length)
  return [average(sum.red), average(sum.green), average(sum.blue), alpha]
}

function colorAt(point: Point): Color | undefined {
  if (!isInRoundedSquare(point)) {
    return undefined
  }
  return isInPolygon(point, M) ? LETTER : BACKGROUND
}

// Inside the square, and not past the circle of the corner it is nearest to.
function isInRoundedSquare({ x, y }: Point): boolean {
  const nearestX = Math.min(Math.max(x, CORNER_RADIUS), 1 - CORNER_RADIUS)
  const nearestY = Math.min(Math.max(y, CORNER_RADIUS), 1 - CORNER_RADIUS)
  return Math.hypot(x - nearestX, y - nearestY) <= CORNER_RADIUS
}

// Even-odd rule: a point is inside when a ray from it crosses the edges an odd number of times.
function isInPolygon(point: Point, [first, ...rest]: Polygon): boolean {
  let isInside = false
  let start = first
  for (const end of [...rest, first]) {
    if (crosses(point, start, end)) {
      isInside = !isInside
    }
    start = end
  }
  return isInside
}

// Whether the ray from the point to the right crosses the edge from start to end.
function crosses(point: Point, start: Point, end: Point): boolean {
  const isAcross = start.y > point.y !== end.y > point.y
  return (
    isAcross && point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x
  )
}
