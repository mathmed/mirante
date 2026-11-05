import { type Mark, PALETTE } from './mark.ts'
import { arcPoints, type Point, type Shape, ShapeKind } from './shapes.ts'

// Two other marks for the owner to compare with the one of the app, in the same palette and on
// the same icon: only the screenshot docs/screenshots/icone-alternativas.webp shows them (make
// screenshots), never the app nor the TV packages.
const LINE_RADIUS = 0.04
const LENS_RADIUS = 0.024
// Segments of a half circle: under round joins, nobody tells them from the curve.
const ARC_STEPS = 32
const LENS_STEPS = 64
const HALF_TURN = 180
// How far below its center line the arc of the lens comes down, on each side.
const LENS_OPENING_DEGREES = 25
const HALF = 0.5

// The stems of the m, its x-height and the radius of its two arches.
const STEMS = { left: 0.335, middle: 0.5, right: 0.665 } as const
const STEM_TOP = 0.47
const STEM_BOTTOM = 0.66
const ARCH_RADIUS = (STEMS.middle - STEMS.left) * HALF

// (B) A geometric lowercase m inside the arc of a lens, open below like the view from a lookout.
export const MONOGRAM_MARK: Mark = [
  {
    kind: ShapeKind.Stroke,
    points: arcPoints({
      center: { x: 0.5, y: 0.52 },
      radius: 0.3,
      fromDegrees: HALF_TURN + LENS_OPENING_DEGREES,
      toDegrees: -LENS_OPENING_DEGREES,
      steps: LENS_STEPS,
    }),
    radius: LENS_RADIUS,
    color: PALETTE.darkAmber,
  },
  mStroke(STEMS.left, STEMS.middle, { isFirst: true }),
  mStroke(STEMS.middle, STEMS.right, { isFirst: false }),
]

// (C) The corners of the frame of a camera, and a dot on a third of it, where a photo puts what
// matters.
const FRAME = { left: 0.26, top: 0.28, right: 0.74, bottom: 0.72 }
const CORNER = 0.13

export const FRAME_MARK: Mark = [
  corner({ x: FRAME.left, y: FRAME.top }, 1, 1),
  corner({ x: FRAME.right, y: FRAME.top }, -1, 1),
  corner({ x: FRAME.left, y: FRAME.bottom }, 1, -1),
  corner({ x: FRAME.right, y: FRAME.bottom }, -1, -1),
  {
    kind: ShapeKind.Disk,
    center: { x: 0.58, y: 0.44 },
    radius: 0.062,
    color: PALETTE.lightAmber,
  },
]

interface StrokeOptions {
  // The first arch starts with the stem on its left; the second shares it.
  readonly isFirst: boolean
}

function mStroke(left: number, right: number, { isFirst }: StrokeOptions): Shape {
  const [archStart, ...arch] = arcPoints({
    center: { x: (left + right) * HALF, y: STEM_TOP },
    radius: ARCH_RADIUS,
    fromDegrees: HALF_TURN,
    toDegrees: 0,
    steps: ARC_STEPS,
  })
  const end = { x: right, y: STEM_BOTTOM }
  return {
    kind: ShapeKind.Stroke,
    points: isFirst
      ? [{ x: left, y: STEM_BOTTOM }, archStart, ...arch, end]
      : [archStart, ...arch, end],
    radius: LINE_RADIUS,
    color: PALETTE.amber,
  }
}

// An L along two edges of the frame, from its corner: the directions say which way each arm goes.
function corner(at: Point, across: number, down: number): Shape {
  return {
    kind: ShapeKind.Stroke,
    points: [{ x: at.x, y: at.y + down * CORNER }, at, { x: at.x + across * CORNER, y: at.y }],
    radius: LINE_RADIUS,
    color: PALETTE.amber,
  }
}
