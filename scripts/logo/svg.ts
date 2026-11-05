import { MARK, PALETTE } from './mark.ts'
import { boundsOf, hexOf, svgPathOf } from './shapes.ts'

// The logo as SVG files, written from the geometry of the mark: the mark alone (what the app
// shows), the icon (the mark on the rounded dark square of the TV icons) and the horizontal logo,
// the mark and the name MIRANTE in the serif of the app, widely spaced.
const SIZE = 1000
const ICON_CORNER = 200
const NAME = 'MIRANTE'
const FONT_FAMILY = 'Playfair Display'
const FALLBACK_FONTS = 'Georgia, serif'
// The horizontal logo, in the units of its view box: the mark, its height, then the name, which
// stands on the horizon of the mark and fills the given width whatever font draws it.
const LOGO_PADDING = 120
const LOGO_MARK_HEIGHT = 360
const LOGO_GAP = 100
const NAME_SIZE = 190
const NAME_WIDTH = 1240
const LOGO_CORNER = 60
const HORIZON_Y = 0.615
// The scale of the mark in the horizontal logo keeps three decimals.
const SCALE_STEPS = 1000

const BOUNDS = boundsOf(MARK)

export function markSvg(): string {
  const width = Math.round((BOUNDS.right - BOUNDS.left) * SIZE)
  const height = Math.round((BOUNDS.bottom - BOUNDS.top) * SIZE)
  const viewBox = `${String(Math.round(BOUNDS.left * SIZE))} ${String(Math.round(BOUNDS.top * SIZE))} ${String(width)} ${String(height)}`
  return svgDocument({ viewBox, width, height, title: NAME, body: shapesSvg() })
}

export function iconSvg(): string {
  const background = `<rect width="${String(SIZE)}" height="${String(SIZE)}" rx="${String(ICON_CORNER)}" fill="${hexOf(PALETTE.background)}"/>`
  return svgDocument({
    viewBox: `0 0 ${String(SIZE)} ${String(SIZE)}`,
    width: SIZE,
    height: SIZE,
    title: NAME,
    body: `${background}\n${shapesSvg()}`,
  })
}

// The font travels inside the file (an image loads nothing else): the WOFF2 the app ships.
export function logoSvg(font: Uint8Array): string {
  const exactScale = LOGO_MARK_HEIGHT / ((BOUNDS.bottom - BOUNDS.top) * SIZE)
  const scale = Math.round(exactScale * SCALE_STEPS) / SCALE_STEPS
  const markWidth = Math.round((BOUNDS.right - BOUNDS.left) * SIZE * scale)
  const nameX = LOGO_PADDING + markWidth + LOGO_GAP
  const width = nameX + NAME_WIDTH + LOGO_PADDING
  const height = LOGO_PADDING + LOGO_MARK_HEIGHT + LOGO_PADDING
  const baseline = Math.round(LOGO_PADDING + (HORIZON_Y - BOUNDS.top) * SIZE * scale)
  const style = `<style>@font-face{font-family:'${FONT_FAMILY}';src:url(data:font/woff2;base64,${Buffer.from(font).toString('base64')}) format('woff2')}</style>`
  const background = `<rect width="${String(width)}" height="${String(height)}" rx="${String(LOGO_CORNER)}" fill="${hexOf(PALETTE.background)}"/>`
  const mark = `<g transform="translate(${String(LOGO_PADDING - Math.round(BOUNDS.left * SIZE * scale))} ${String(LOGO_PADDING - Math.round(BOUNDS.top * SIZE * scale))}) scale(${String(scale)})">\n${shapesSvg()}\n</g>`
  const name = `<text x="${String(nameX)}" y="${String(baseline)}" font-family="'${FONT_FAMILY}', ${FALLBACK_FONTS}" font-size="${String(NAME_SIZE)}" textLength="${String(NAME_WIDTH)}" lengthAdjust="spacing" fill="${hexOf(PALETTE.lightGold)}">${NAME}</text>`
  return svgDocument({
    viewBox: `0 0 ${String(width)} ${String(height)}`,
    width,
    height,
    title: NAME,
    body: [style, background, mark, name].join('\n'),
  })
}

interface SvgDocument {
  readonly viewBox: string
  readonly width: number
  readonly height: number
  readonly title: string
  readonly body: string
}

function svgDocument({ viewBox, width, height, title, body }: SvgDocument): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${String(width)}" height="${String(height)}" role="img" aria-label="${title}">\n<title>${title}</title>\n${body}\n</svg>\n`
}

function shapesSvg(): string {
  return MARK.map(
    (shape) => `<path d="${svgPathOf(shape, SIZE)}" fill="${hexOf(shape.color)}"/>`,
  ).join('\n')
}
