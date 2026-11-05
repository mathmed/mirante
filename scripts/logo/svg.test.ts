import { describe, expect, it } from 'vitest'

import { ICON_BACKGROUND, MARK, PALETTE } from './mark.ts'
import { hexOf, svgElementOf } from './shapes.ts'
import { iconSvg, logoSvg, markSvg } from './svg.ts'

const FONT = new Uint8Array([0x77, 0x4f, 0x46, 0x32])

function elements(svg: string): string[] {
  return [...svg.matchAll(/<(?:path|circle) [^>]+\/>/g)].map((match) => match[0])
}

const MARK_ELEMENTS = MARK.map((shape) => svgElementOf(shape, 1000))

describe('markSvg', () => {
  it('should draw every shape of the mark in its color, in the order they are painted', () => {
    expect(elements(markSvg(MARK))).toStrictEqual(MARK_ELEMENTS)
  })

  it('should frame the mark tightly, on a square of 1000', () => {
    const sut = markSvg(MARK)

    expect(sut).toContain('viewBox="204 246 602 490" width="602" height="490"')
    expect(sut).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" /)
    expect(sut).toContain('<title>Mirante</title>')
  })
})

describe('iconSvg', () => {
  it('should draw the mark on the rounded square of the graphite gradient', () => {
    const sut = iconSvg(MARK)

    expect(sut).toContain('viewBox="0 0 1000 1000"')
    expect(sut).toContain(
      `<linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hexOf(ICON_BACKGROUND.from)}"/><stop offset="1" stop-color="${hexOf(ICON_BACKGROUND.to)}"/></linearGradient>`,
    )
    expect(sut).toContain('<rect width="1000" height="1000" rx="225" fill="url(#background)"/>')
    expect(elements(sut)).toStrictEqual(MARK_ELEMENTS)
  })

  it('should draw any mark it is given', () => {
    const [stroke] = MARK

    expect(elements(iconSvg([stroke]))).toStrictEqual([svgElementOf(stroke, 1000)])
  })
})

describe('logoSvg', () => {
  it('should carry the font inside the file', () => {
    expect(logoSvg(FONT)).toContain(
      "@font-face{font-family:'Manrope';font-weight:600;src:url(data:font/woff2;base64,d09GMg==) format('woff2')}",
    )
  })

  it('should write the name in lowercase semibold, on the ground of the M, slightly tightened', () => {
    const sut = logoSvg(FONT)

    expect(sut).toContain(
      `<text x="548" y="410" font-family="'Manrope', system-ui, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="200" letter-spacing="-4" textLength="712" lengthAdjust="spacing" fill="${hexOf(PALETTE.text)}">mirante</text>`,
    )
    expect(sut).toContain('viewBox="0 0 1370 520"')
    expect(sut).toContain(`fill="${hexOf(PALETTE.background)}"`)
  })

  it('should scale the mark to the height of the logo, inside its margins', () => {
    const sut = logoSvg(FONT)

    expect(sut).toContain('<g transform="translate(-15 -41) scale(0.612)">')
    expect(elements(sut)).toStrictEqual(MARK_ELEMENTS)
  })
})
