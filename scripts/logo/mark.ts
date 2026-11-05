import { type Color, type Shape, ShapeKind } from './shapes.ts'

// The mark of Mirante, the lookout: two rounded peaks, one stroke of amber, that make a geometric
// M, and the sun, a dot above and to the right of the right peak, as seen from the top of a
// lookout over the horizon. Drawn on a square of side 1 for the icons of the TVs and the logo files;
// the app shows the SVG the logo script writes from it. The colors are those of src/ui/styles.css.
export const PALETTE = {
  background: { red: 0x0c, green: 0x0c, blue: 0x0e },
  amber: { red: 0xf0, green: 0xb6, blue: 0x5a },
  lightAmber: { red: 0xff, green: 0xd0, blue: 0x8a },
  darkAmber: { red: 0xb8, green: 0x80, blue: 0x2d },
  text: { red: 0xf4, green: 0xf4, blue: 0xf6 },
} as const satisfies Readonly<Record<string, Color>>

// The rounded square of the icons, graphite, lighter at the top left corner than at the bottom
// right one.
export interface IconBackground {
  readonly from: Color
  readonly to: Color
  // Of the corners, on the side of 1.
  readonly cornerRadius: number
}

export const ICON_BACKGROUND: IconBackground = {
  from: { red: 0x1b, green: 0x1b, blue: 0x20 },
  to: { red: 0x0e, green: 0x0e, blue: 0x11 },
  cornerRadius: 0.225,
}

export type Mark = readonly [Shape, ...Shape[]]

// The width of the line of the M: thick enough to read on the 80 pixels of the smallest icon.
const LINE_RADIUS = 0.046
const SUN_RADIUS = 0.044

// In the order they are painted: a later shape covers an earlier one.
export const MARK: Mark = [
  {
    kind: ShapeKind.Stroke,
    points: [
      { x: 0.25, y: 0.69 },
      { x: 0.385, y: 0.42 },
      { x: 0.5, y: 0.6 },
      { x: 0.625, y: 0.36 },
      { x: 0.76, y: 0.69 },
    ],
    radius: LINE_RADIUS,
    color: PALETTE.amber,
  },
  {
    kind: ShapeKind.Disk,
    center: { x: 0.75, y: 0.29 },
    radius: SUN_RADIUS,
    color: PALETTE.lightAmber,
  },
]
