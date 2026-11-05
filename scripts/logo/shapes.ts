// The shapes the logo is drawn with, on a square of side 1 (y grows downwards). Each one answers two
// questions: whether a point is inside it (the PNG icons sample the shapes pixel by pixel) and what
// its SVG path is (the logo files), so that both come from the same geometry.
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
  Polygon: 'polygon',
  Bar: 'bar',
  Arch: 'arch',
} as const

// Any polygon, filled with the even-odd rule.
interface PolygonShape {
  readonly kind: typeof ShapeKind.Polygon
  readonly points: readonly [Point, ...Point[]]
}

// A horizontal line with round ends: the points closer than the radius to the segment.
interface BarShape {
  readonly kind: typeof ShapeKind.Bar
  readonly y: number
  readonly left: number
  readonly right: number
  readonly radius: number
}

// The upper half of a ring, its ends cut flat on the line through its center.
interface ArchShape {
  readonly kind: typeof ShapeKind.Arch
  readonly center: Point
  readonly outerRadius: number
  readonly innerRadius: number
}

type Geometry = ArchShape | BarShape | PolygonShape

export type Shape = Geometry & { readonly color: Color }

const HEX_BASE = 16
const HEX_DIGITS = 2
// Paths keep one decimal: on the square of 1000 of the SVG files, far finer than any screen.
const PRECISION = 10

// The smallest box around the shapes.
export interface Bounds {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export function isInShape(shape: Shape, point: Point): boolean {
  switch (shape.kind) {
    case ShapeKind.Polygon:
      return isInPolygon(point, shape.points)
    case ShapeKind.Bar:
      return isInBar(point, shape)
    default:
      return isInArch(point, shape)
  }
}

// The path of the shape scaled to a square of side `size`.
export function svgPathOf(shape: Shape, size: number): string {
  const at = (value: number): string => String(Math.round(value * size * PRECISION) / PRECISION)
  switch (shape.kind) {
    case ShapeKind.Polygon:
      return polygonPath(shape.points, at)
    case ShapeKind.Bar:
      return barPath(shape, at)
    default:
      return archPath(shape, at)
  }
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

type Format = (value: number) => string

function shapeBounds(shape: Shape): Bounds {
  switch (shape.kind) {
    case ShapeKind.Polygon:
      return polygonBounds(shape.points)
    case ShapeKind.Bar:
      return {
        left: shape.left - shape.radius,
        top: shape.y - shape.radius,
        right: shape.right + shape.radius,
        bottom: shape.y + shape.radius,
      }
    default:
      return {
        left: shape.center.x - shape.outerRadius,
        top: shape.center.y - shape.outerRadius,
        right: shape.center.x + shape.outerRadius,
        bottom: shape.center.y,
      }
  }
}

function polygonBounds(points: readonly Point[]): Bounds {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  }
}

function polygonPath([first, ...rest]: readonly [Point, ...Point[]], at: Format): string {
  const lines = rest.map((point) => `L${at(point.x)} ${at(point.y)}`).join('')
  return `M${at(first.x)} ${at(first.y)}${lines}Z`
}

function barPath({ y, left, right, radius }: BarShape, at: Format): string {
  const arc = `A${at(radius)} ${at(radius)} 0 0 1`
  return `M${at(left)} ${at(y - radius)}H${at(right)}${arc} ${at(right)} ${at(y + radius)}H${at(left)}${arc} ${at(left)} ${at(y - radius)}Z`
}

// Clockwise over the top along the outer circle, back along the inner one.
function archPath({ center, outerRadius, innerRadius }: ArchShape, at: Format): string {
  const outer = `A${at(outerRadius)} ${at(outerRadius)} 0 0 1 ${at(center.x + outerRadius)} ${at(center.y)}`
  const inner = `A${at(innerRadius)} ${at(innerRadius)} 0 0 0 ${at(center.x - innerRadius)} ${at(center.y)}`
  return `M${at(center.x - outerRadius)} ${at(center.y)}${outer}H${at(center.x + innerRadius)}${inner}Z`
}

// Squared distances: the icons test every shape at thousands of points.
function isInBar(point: Point, { y, left, right, radius }: BarShape): boolean {
  const nearestX = Math.min(Math.max(point.x, left), right)
  return squaredDistance(point, { x: nearestX, y }) <= radius * radius
}

function isInArch(point: Point, { center, outerRadius, innerRadius }: ArchShape): boolean {
  const distance = squaredDistance(point, center)
  return (
    point.y <= center.y &&
    distance >= innerRadius * innerRadius &&
    distance <= outerRadius * outerRadius
  )
}

function squaredDistance(first: Point, second: Point): number {
  const dx = first.x - second.x
  const dy = first.y - second.y
  return dx * dx + dy * dy
}

// Even-odd rule: a point is inside when a ray from it crosses the edges an odd number of times.
function isInPolygon(point: Point, points: readonly [Point, ...Point[]]): boolean {
  let isInside = false
  let start = points[points.length - 1] ?? points[0]
  for (const end of points) {
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
