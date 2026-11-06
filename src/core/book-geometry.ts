// The geometry of a page of a book. A page is 4:3, as wide as two of them side by side fit on a TV,
// and its height is the unit of every length here: a page is PAGE_ASPECT wide and 1 high. What the
// book hands out is normalized instead: fractions of the width and of the height of the page.
export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const PAGE_WIDTH = 4
const PAGE_HEIGHT = 3
export const PAGE_ASPECT = PAGE_WIDTH / PAGE_HEIGHT

const MARGIN_SHARE = 0.06
const GAP_SHARE = 0.02
// A margin on each side.
const SIDES = 2

// Around the photos, 6% of the width of the page on every side, at least: the photos of a page take
// their natural shape, so the margin grows on two sides when it does not match the page's.
export const MARGIN = MARGIN_SHARE * PAGE_ASPECT
// Between two photos, always the same.
export const GAP = GAP_SHARE * PAGE_ASPECT

// Where the photos of a page go.
export const CONTENT: Rect = {
  x: MARGIN,
  y: MARGIN,
  width: PAGE_ASPECT - SIDES * MARGIN,
  height: 1 - SIDES * MARGIN,
}

const HALF = 0.5

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

// From page heights to fractions of the page.
export function normalized(rect: Rect): Rect {
  return {
    x: rect.x / PAGE_ASPECT,
    y: rect.y,
    width: rect.width / PAGE_ASPECT,
    height: rect.height,
  }
}
