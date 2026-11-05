import { ICON_BACKGROUND, MARK, type Mark, PALETTE } from './mark.ts'
import { boundsOf, hexOf, svgElementOf } from './shapes.ts'

// The logo as SVG files, written from the geometry of the mark: the mark alone (what the app
// shows), the icon (the mark on the rounded graphite square of the TV icons) and the horizontal
// logo, the mark and the name in lowercase, in the semibold of the app, slightly tightened.
const SIZE = 1000
const TITLE = 'Mirante'
const NAME = 'mirante'
const FONT_FAMILY = 'Manrope'
const FONT_WEIGHT = 600
const FALLBACK_FONTS = "system-ui, 'Segoe UI', Roboto, sans-serif"
// The horizontal logo, in the units of its view box: the mark, its height, then the name, which
// stands on the ground of the M, tightened by a fiftieth of its size between letters, and fills the
// given width whatever font draws it.
const LOGO_PADDING = 110
const LOGO_MARK_HEIGHT = 300
const LOGO_GAP = 70
const NAME_SIZE = 200
const NAME_WIDTH = 712
const LETTER_SPACING = -4
const LOGO_CORNER = 60
// The scale of the mark in the horizontal logo keeps three decimals.
const SCALE_STEPS = 1000

export function markSvg(mark: Mark): string {
  const bounds = boundsOf(mark)
  const width = Math.round((bounds.right - bounds.left) * SIZE)
  const height = Math.round((bounds.bottom - bounds.top) * SIZE)
  const viewBox = `${String(Math.round(bounds.left * SIZE))} ${String(Math.round(bounds.top * SIZE))} ${String(width)} ${String(height)}`
  return svgDocument({ viewBox, width, height, body: shapesSvg(mark) })
}

export function iconSvg(mark: Mark): string {
  const gradient = `<defs><linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hexOf(ICON_BACKGROUND.from)}"/><stop offset="1" stop-color="${hexOf(ICON_BACKGROUND.to)}"/></linearGradient></defs>`
  const square = `<rect width="${String(SIZE)}" height="${String(SIZE)}" rx="${String(ICON_BACKGROUND.cornerRadius * SIZE)}" fill="url(#background)"/>`
  return svgDocument({
    viewBox: `0 0 ${String(SIZE)} ${String(SIZE)}`,
    width: SIZE,
    height: SIZE,
    body: [gradient, square, shapesSvg(mark)].join('\n'),
  })
}

// The font travels inside the file (an image loads nothing else): the WOFF2 the app ships.
export function logoSvg(font: Uint8Array): string {
  const bounds = boundsOf(MARK)
  const exactScale = LOGO_MARK_HEIGHT / ((bounds.bottom - bounds.top) * SIZE)
  const scale = Math.round(exactScale * SCALE_STEPS) / SCALE_STEPS
  const markWidth = Math.round((bounds.right - bounds.left) * SIZE * scale)
  const nameX = LOGO_PADDING + markWidth + LOGO_GAP
  const width = nameX + NAME_WIDTH + LOGO_PADDING
  const height = LOGO_PADDING + LOGO_MARK_HEIGHT + LOGO_PADDING
  const style = `<style>@font-face{font-family:'${FONT_FAMILY}';font-weight:${String(FONT_WEIGHT)};src:url(data:font/woff2;base64,${Buffer.from(font).toString('base64')}) format('woff2')}</style>`
  const background = `<rect width="${String(width)}" height="${String(height)}" rx="${String(LOGO_CORNER)}" fill="${hexOf(PALETTE.background)}"/>`
  const mark = `<g transform="translate(${String(LOGO_PADDING - Math.round(bounds.left * SIZE * scale))} ${String(LOGO_PADDING - Math.round(bounds.top * SIZE * scale))}) scale(${String(scale)})">\n${shapesSvg(MARK)}\n</g>`
  const name = `<text x="${String(nameX)}" y="${String(LOGO_PADDING + LOGO_MARK_HEIGHT)}" font-family="'${FONT_FAMILY}', ${FALLBACK_FONTS}" font-weight="${String(FONT_WEIGHT)}" font-size="${String(NAME_SIZE)}" letter-spacing="${String(LETTER_SPACING)}" textLength="${String(NAME_WIDTH)}" lengthAdjust="spacing" fill="${hexOf(PALETTE.text)}">${NAME}</text>`
  return svgDocument({
    viewBox: `0 0 ${String(width)} ${String(height)}`,
    width,
    height,
    body: [style, background, mark, name].join('\n'),
  })
}

interface SvgDocument {
  readonly viewBox: string
  readonly width: number
  readonly height: number
  readonly body: string
}

function svgDocument({ viewBox, width, height, body }: SvgDocument): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${String(width)}" height="${String(height)}" role="img" aria-label="${TITLE}">\n<title>${TITLE}</title>\n${body}\n</svg>\n`
}

function shapesSvg(mark: Mark): string {
  return mark.map((shape) => svgElementOf(shape, SIZE)).join('\n')
}
