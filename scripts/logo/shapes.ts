// The shapes the logo is drawn with, on a square of side 1 (y grows downwards). Each one answers two
// questions: whether a point is inside it (the PNG icons sample the shapes pixel by pixel) and what
// its SVG element is (the logo files), so that both come from the same geometry.
export interface Point {
  readonly x: number
  readonly y: number
}

export interface Color {
  readonly red: number
  readonly green: number
  readonly blue: number
}

export const ShapeKind = {
  Stroke: 'stroke',
  Disk: 'disk',
} as const

// A line through the points, of the same width all along, with round ends and round corners: the
// points closer than the radius to one of its segments, which is what SVG draws for a stroke with
// round caps and joins.
interface StrokeShape {
  readonly kind: typeof ShapeKind.Stroke
  readonly points: readonly [Point, ...Point[]]
  readonly radius: number
}

interface DiskShape {
  readonly kind: typeof ShapeKind.Disk
  readonly center: Point
  readonly radius: number
}

type Geometry = DiskShape | StrokeShape

export type Shape = Geometry & { readonly color: Color }

const HEX_BASE = 16
const HEX_DIGITS = 2
// Coordinates keep one decimal: on the square of 1000 of the SVG files, far finer than any screen.
const PRECISION = 10
const DEGREES = 180
// A stroke is as wide as two of its radii.
const RADII_PER_WIDTH = 2

// The smallest box around the shapes.
export interface Bounds {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export interface Arc {
  readonly center: Point
  readonly radius: number
  // In degrees, counterclockwise from the right as on a clock face seen from the front: 90 is the
  // top of the circle.
  readonly fromDegrees: number
  readonly toDegrees: number
  readonly steps: number
}

export function isInShape(shape: Shape, point: Point): boolean {
  const radius = shape.radius * shape.radius
  if (shape.kind === ShapeKind.Disk) {
    return squaredDistance(point, shape.center) <= radius
  }
  return segmentsOf(shape.points).some(
    ([start, end]) => squaredDistanceToSegment(point, start, end) <= radius,
  )
}

// The element of the shape scaled to a square of side `size`.
export function svgElementOf(shape: Shape, size: number): string {
  const at = (value: number): string => String(Math.round(value * size * PRECISION) / PRECISION)
  const color = hexOf(shape.color)
  if (shape.kind === ShapeKind.Disk) {
    return `<circle cx="${at(shape.center.x)}" cy="${at(shape.center.y)}" r="${at(shape.radius)}" fill="${color}"/>`
  }
  const [first, ...rest] = shape.points
  const lines = rest.map((point) => `L${at(point.x)} ${at(point.y)}`).join('')
  return `<path d="M${at(first.x)} ${at(first.y)}${lines}" fill="none" stroke="${color}" stroke-width="${at(shape.radius * RADII_PER_WIDTH)}" stroke-linecap="round" stroke-linejoin="round"/>`
}

export function boundsOf([first, ...rest]: readonly [Shape, ...Shape[]]): Bounds {
  return rest.map(shapeBounds).reduce(
    (total, bounds) => ({
      left: Math.min(total.left, bounds.left),
      top: Math.min(total.top, bounds.top),
      right: Math.max(total.right, bounds.right),
      bottom: Math.max(total.bottom, bounds.bottom),
    }),
    shapeBounds(first),
  )
}

export function hexOf({ red, green, blue }: Color): string {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(HEX_BASE).padStart(HEX_DIGITS, '0'))
    .join('')
    .toUpperCase()}`
}

// The color a share of the way from one color to the other, each channel rounded.
export function mixOf(from: Color, to: Color, share: number): Color {
  const mix = (start: number, end: number): number => Math.round(start + (end - start) * share)
  return {
    red: mix(from.red, to.red),
    green: mix(from.green, to.green),
    blue: mix(from.blue, to.blue),
  }
}

// The points of an arc of a circle, its ends included, for a stroke to follow: short enough
// segments that, under round joins, nobody tells them from the curve.
export function arcPoints({
  center,
  radius,
  fromDegrees,
  toDegrees,
  steps,
}: Arc): [Point, ...Point[]] {
  const pointAt = (step: number): Point => {
    const degrees = fromDegrees + ((toDegrees - fromDegrees) * step) / steps
    const angle = (degrees * Math.PI) / DEGREES
    return { x: center.x + radius * Math.cos(angle), y: center.y - radius * Math.sin(angle) }
  }
  return [pointAt(0), ...[...new Array<undefined>(steps).keys()].map((index) => pointAt(index + 1))]
}

function shapeBounds(shape: Shape): Bounds {
  const points = shape.kind === ShapeKind.Disk ? [shape.center] : shape.points
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    left: Math.min(...xs) - shape.radius,
    top: Math.min(...ys) - shape.radius,
    right: Math.max(...xs) + shape.radius,
    bottom: Math.max(...ys) + shape.radius,
  }
}

// A stroke of one point is a dot: its only segment goes from the point to itself.
function segmentsOf([first, ...rest]: readonly [Point, ...Point[]]): (readonly [Point, Point])[] {
  const segments: (readonly [Point, Point])[] = []
  let start = first
  for (const end of rest) {
    segments.push([start, end])
    start = end
  }
  return segments.length === 0 ? [[first, first]] : segments
}

// Squared distances: the icons test every shape at thousands of points.
function squaredDistanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = dx * dx + dy * dy
  const along = length === 0 ? 0 : ((point.x - start.x) * dx + (point.y - start.y) * dy) / length
  const share = Math.min(Math.max(along, 0), 1)
  return squaredDistance(point, { x: start.x + share * dx, y: start.y + share * dy })
}

function squaredDistance(first: Point, second: Point): number {
  const dx = first.x - second.x
  const dy = first.y - second.y
  return dx * dx + dy * dy
}
