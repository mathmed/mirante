// The geometry of a page of a book. The shape of a page is a parameter, its width over its height
// (its aspect), and its height is the unit of every length here: a page is `aspect` wide and 1
// high. What the book hands out is normalized instead: fractions of the width and of the height of
// the page.
export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

// The shape of the pages, a setting: full screen, two pages of 8:9 making a 16:9 spread, the shape
// of a TV; or classic, the pages of 4:3 the book had first.
export const BookFormat = {
  Wide: 'wide',
  Classic: 'classic',
} as const

export type BookFormat = (typeof BookFormat)[keyof typeof BookFormat]

const WIDE_WIDTH = 8
const WIDE_HEIGHT = 9
const CLASSIC_WIDTH = 4
const CLASSIC_HEIGHT = 3

const PAGE_ASPECTS: ReadonlyMap<BookFormat, number> = new Map([
  [BookFormat.Wide, WIDE_WIDTH / WIDE_HEIGHT],
  [BookFormat.Classic, CLASSIC_WIDTH / CLASSIC_HEIGHT],
])

export interface PageGeometry {
  // The width of the page over its height.
  readonly aspect: number
  // Around the photos, at least, on every side.
  readonly margin: number
  // Between two photos, always the same.
  readonly gap: number
  // Where the photos of a page go.
  readonly content: Rect
}

// Shares of the width of the page: the margins and the gap follow its width, whatever its shape.
const MARGIN_SHARE = 0.04
const GAP_SHARE = 0.015
// A margin on each side.
const SIDES = 2
const HALF = 0.5

export function pageAspectOf(format: BookFormat): number {
  const aspect = PAGE_ASPECTS.get(format)
  if (aspect === undefined) {
    throw new RangeError(`No book format "${format}"`)
  }
  return aspect
}

// Around the photos, 4% of the width of the page on every side, at least: the photos of a page take
// their natural shape, so the margin grows on two sides when it does not match the page's. Between
// two photos, 1.5% of the width.
export function pageGeometry(aspect: number): PageGeometry {
  if (aspect <= 0 || !Number.isFinite(aspect)) {
    throw new RangeError(`No page of aspect ${String(aspect)}`)
  }
  const margin = MARGIN_SHARE * aspect
  return {
    aspect,
    margin,
    gap: GAP_SHARE * aspect,
    content: {
      x: margin,
      y: margin,
      width: aspect - SIDES * margin,
      height: 1 - SIDES * margin,
    },
  }
}

// The largest rectangle of this width over height inside the box, in its middle: a photo placed
// there is whole, never cut and never stretched.
export function fitInside(aspect: number, box: Rect): Rect {
  const width = Math.min(box.width, box.height * aspect)
  const height = width / aspect
  return {
    x: box.x + (box.width - width) * HALF,
    y: box.y + (box.height - height) * HALF,
    width,
    height,
  }
}

export function areaOf(rect: Rect): number {
  return rect.width * rect.height
}

// From page heights to fractions of a page of this aspect.
export function normalized(rect: Rect, aspect: number): Rect {
  return {
    x: rect.x / aspect,
    y: rect.y,
    width: rect.width / aspect,
    height: rect.height,
  }
}
