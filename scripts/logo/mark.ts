import { type Color, type Point, type Shape, ShapeKind } from './shapes.ts'

// The mark of Mirante, the lookout: an M standing on the horizon under the arch of a rising sun,
// over two lines of water fading into the dark. Drawn on a square of side 1 for the icons of the
// TVs and the logo files; the app shows the SVG the logo script writes from it.
export const PALETTE = {
  background: { red: 0x0e, green: 0x0c, blue: 0x09 },
  gold: { red: 0xd4, green: 0xa9, blue: 0x3c },
  lightGold: { red: 0xf0, green: 0xcf, blue: 0x7a },
  darkGold: { red: 0x8a, green: 0x6a, blue: 0x1f },
} as const satisfies Readonly<Record<string, Color>>

const HORIZON_Y = 0.615
const LINE_RADIUS = 0.018
const WATER_RADIUS = 0.014

// Where the M stands: on the horizon, inside the arch.
const LETTER_BOX = { left: 0.34, top: 0.37, right: 0.66, bottom: HORIZON_Y - LINE_RADIUS }

// The M of a serif with contrast, on a box of side 1: a thin left stem, a thick left diagonal, a
// thin right diagonal and a thick right stem, with flat serifs.
const LETTER: readonly (readonly [Point, ...Point[]])[] = [
  rectangle({ left: 0.08, top: 0, right: 0.15, bottom: 1 }),
  [
    { x: 0.08, y: 0 },
    { x: 0.3, y: 0 },
    { x: 0.57, y: 1 },
    { x: 0.44, y: 1 },
  ],
  [
    { x: 0.8, y: 0 },
    { x: 0.88, y: 0 },
    { x: 0.57, y: 1 },
    { x: 0.5, y: 1 },
  ],
  rectangle({ left: 0.8, top: 0, right: 0.94, bottom: 1 }),
  rectangle({ left: 0, top: 0, right: 0.08, bottom: 0.05 }),
  rectangle({ left: 0.94, top: 0, right: 1, bottom: 0.05 }),
  rectangle({ left: 0, top: 0.95, right: 0.23, bottom: 1 }),
  rectangle({ left: 0.71, top: 0.95, right: 1, bottom: 1 }),
]

// In the order they are painted: a later shape covers an earlier one.
export const MARK: readonly [Shape, ...Shape[]] = [
  {
    kind: ShapeKind.Arch,
    center: { x: 0.5, y: HORIZON_Y },
    outerRadius: 0.37,
    innerRadius: 0.33,
    color: PALETTE.gold,
  },
  ...LETTER.map((points): Shape => ({
    kind: ShapeKind.Polygon,
    points: inLetterBox(points),
    color: PALETTE.lightGold,
  })),
  bar({ y: HORIZON_Y, left: 0.08, right: 0.92, radius: LINE_RADIUS }, PALETTE.gold),
  bar({ y: 0.7, left: 0.27, right: 0.73, radius: WATER_RADIUS }, PALETTE.gold),
  bar({ y: 0.775, left: 0.39, right: 0.61, radius: WATER_RADIUS }, PALETTE.darkGold),
]

interface BarLine {
  readonly y: number
  readonly left: number
  readonly right: number
  readonly radius: number
}

function bar(line: BarLine, color: Color): Shape {
  return { kind: ShapeKind.Bar, ...line, color }
}

interface Box {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

function rectangle({ left, top, right, bottom }: Box): [Point, ...Point[]] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ]
}

function inLetterBox([first, ...rest]: readonly [Point, ...Point[]]): [Point, ...Point[]] {
  const width = LETTER_BOX.right - LETTER_BOX.left
  const height = LETTER_BOX.bottom - LETTER_BOX.top
  const place = ({ x, y }: Point): Point => ({
    x: LETTER_BOX.left + x * width,
    y: LETTER_BOX.top + y * height,
  })
  return [place(first), ...rest.map(place)]
}
