// The page of docs/screenshots/icone-alternativas.webp (make screenshots): the icon of the app (A)
// beside the two alternatives the owner asked to compare (B and C), each large and at the sizes
// of the TV launchers, drawn by the logo script and never shipped. The words are for the owner, in
// Portuguese, in the font of the app.
import { join } from 'node:path'

import { FRAME_MARK, MONOGRAM_MARK } from '../scripts/logo/alternatives.ts'
import { MARK, type Mark, PALETTE } from '../scripts/logo/mark.ts'
import { hexOf } from '../scripts/logo/shapes.ts'
import { iconSvg } from '../scripts/logo/svg.ts'
import { readBytes } from '../scripts/shared/files.ts'

const FONTS = join(import.meta.dirname, '..', 'src', 'ui', 'fonts')
const WEIGHTS = [400, 600] as const
// The large icon, then the sizes of the TV launchers (webOS 130 and 80, Tizen 117).
const LARGE_PIXELS = 360
const SMALL_PIXELS = [130, 117, 80] as const

interface Design {
  readonly letter: string
  readonly title: string
  readonly detail: string
  readonly mark: Mark
}

const DESIGNS: readonly Design[] = [
  { letter: 'A', title: 'Picos e sol', detail: 'o ícone do app neste PR', mark: MARK },
  { letter: 'B', title: 'Monograma na lente', detail: 'alternativa', mark: MONOGRAM_MARK },
  { letter: 'C', title: 'Moldura com ponto', detail: 'alternativa', mark: FRAME_MARK },
]

export async function iconAlternativesPage(): Promise<string> {
  const faces = await Promise.all(WEIGHTS.map(fontFace))
  const style = `${faces.join('')}
body{margin:0;padding:96px;background:${hexOf(PALETTE.background)};color:${hexOf(PALETTE.text)};font-family:Manrope,sans-serif}
h1{margin:0 0 72px;font-size:44px;font-weight:600;letter-spacing:-0.02em}
.designs{display:flex;justify-content:space-between}
.design{width:520px}
.small{display:flex;align-items:flex-end;margin:32px 0}
.small img{margin-right:28px}
h2{margin:0;font-size:36px;font-weight:600}
h2 span{color:${hexOf(PALETTE.amber)}}
p{margin:6px 0 0;font-size:24px;opacity:0.7}`
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${style}</style></head><body><h1>O ícone do Mirante e duas alternativas</h1><div class="designs">${DESIGNS.map(designHtml).join('')}</div></body></html>`
}

async function fontFace(weight: number): Promise<string> {
  const font = await readBytes(join(FONTS, `manrope-latin-${String(weight)}-normal.woff2`))
  return `@font-face{font-family:Manrope;font-weight:${String(weight)};src:url(data:font/woff2;base64,${Buffer.from(font).toString('base64')}) format('woff2')}`
}

function designHtml({ letter, title, detail, mark }: Design): string {
  const url = `data:image/svg+xml,${encodeURIComponent(iconSvg(mark))}`
  const image = (pixels: number): string =>
    `<img src="${url}" width="${String(pixels)}" height="${String(pixels)}" alt="">`
  return `<section class="design">${image(LARGE_PIXELS)}<div class="small">${SMALL_PIXELS.map(image).join('')}</div><h2><span>${letter}</span> · ${title}</h2><p>${detail}</p></section>`
}
