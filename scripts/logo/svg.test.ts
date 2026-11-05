import { describe, expect, it } from 'vitest'

import { MARK, PALETTE } from './mark.ts'
import { hexOf } from './shapes.ts'
import { iconSvg, logoSvg, markSvg } from './svg.ts'

const FONT = new Uint8Array([0x77, 0x4f, 0x46, 0x32])

function paths(svg: string): string[] {
  return [...svg.matchAll(/<path d="[^"]+" fill="(#[\dA-F]{6})"\/>/g)].map(
    (match) => match[1] ?? '',
  )
}

describe('markSvg', () => {
  it('should draw every shape of the mark in its color, in the order they are painted', () => {
    expect(paths(markSvg())).toStrictEqual(MARK.map((shape) => hexOf(shape.color)))
  })

  it('should frame the mark tightly, on a square of 1000', () => {
    const sut = markSvg()

    expect(sut).toContain('viewBox="62 245 876 544" width="876" height="544"')
    expect(sut).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" /)
    expect(sut).toContain('<title>MIRANTE</title>')
  })
})

describe('iconSvg', () => {
  it('should draw the mark on the rounded square of the dark background', () => {
    const sut = iconSvg()

    expect(sut).toContain('viewBox="0 0 1000 1000"')
    expect(sut).toContain(
      `<rect width="1000" height="1000" rx="200" fill="${hexOf(PALETTE.background)}"/>`,
    )
    expect(paths(sut)).toHaveLength(MARK.length)
  })
})

describe('logoSvg', () => {
  it('should carry the font inside the file', () => {
    expect(logoSvg(FONT)).toContain(
      "@font-face{font-family:'Playfair Display';src:url(data:font/woff2;base64,d09GMg==) format('woff2')}",
    )
  })

  it('should write the name in light gold, standing on the horizon of the mark and spread to its width', () => {
    const sut = logoSvg(FONT)

    expect(sut).toContain(
      `<text x="800" y="365" font-family="'Playfair Display', Georgia, serif" font-size="190" textLength="1240" lengthAdjust="spacing" fill="${hexOf(PALETTE.lightGold)}">MIRANTE</text>`,
    )
    expect(sut).toContain('viewBox="0 0 2160 600"')
  })

  it('should scale the mark to the height of the logo, inside its margins', () => {
    const sut = logoSvg(FONT)

    expect(sut).toContain('<g transform="translate(79 -42) scale(0.662)">')
    expect(paths(sut)).toHaveLength(MARK.length)
  })
})
