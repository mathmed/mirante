import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// The palette at the top of styles.css, read as the browser would: each color either written in
// hexadecimal or as rgb() of the channels of another custom property. Read from the file: the
// tests leave the styles out of the modules they import.
const STYLES = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8')
const MIN_TEXT_CONTRAST = 4.5
const CHANNEL_MAX = 255
const HEX_BASE = 16
// The relative luminance and contrast ratio of WCAG 2.
const LINEAR_THRESHOLD = 0.040_45
const LINEAR_SLOPE = 12.92
const GAMMA_OFFSET = 0.055
const GAMMA_SCALE = 1.055
const GAMMA = 2.4
const RED_WEIGHT = 0.2126
const GREEN_WEIGHT = 0.7152
const BLUE_WEIGHT = 0.0722
const CHANNELS = 3
const FLARE = 0.05

type Channels = readonly number[]

function rootProperties(): ReadonlyMap<string, string> {
  const start = STYLES.indexOf(':root {')
  const root = STYLES.slice(start, STYLES.indexOf('}', start))
  // One declaration a line: the colors never span more than one.
  const declarations = root
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('--'))
  return new Map(
    declarations.map((line) => {
      const colon = line.indexOf(':')
      return [
        line.slice('--'.length, colon),
        line
          .slice(colon + 1)
          .replace(';', '')
          .trim(),
      ]
    }),
  )
}

function channelsOf(name: string, properties: ReadonlyMap<string, string>): Channels {
  const value = properties.get(name) ?? ''
  const channels = referencedChannels(value, properties) ?? hexChannels(value)
  if (channels.length !== CHANNELS || channels.some(Number.isNaN)) {
    throw new Error(`--${name} is not a color: "${value}"`)
  }
  return channels
}

// rgb(var(--name-rgb)): the channels of the other custom property.
function referencedChannels(
  value: string,
  properties: ReadonlyMap<string, string>,
): Channels | undefined {
  const reference = /^rgb\(var\(--([\w-]+)\)\)$/.exec(value)?.[1]
  return reference === undefined
    ? undefined
    : (properties.get(reference) ?? '').split(' ').map(Number)
}

function hexChannels(value: string): Channels {
  const pairs = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value)?.slice(1) ?? []
  return pairs.map((pair) => Number.parseInt(pair, HEX_BASE))
}

function luminance(channels: Channels): number {
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => linear(channel / CHANNEL_MAX))
  return RED_WEIGHT * red + GREEN_WEIGHT * green + BLUE_WEIGHT * blue
}

function linear(value: number): number {
  return value <= LINEAR_THRESHOLD
    ? value / LINEAR_SLOPE
    : ((value + GAMMA_OFFSET) / GAMMA_SCALE) ** GAMMA
}

function contrast(text: string, behind: string): number {
  const properties = rootProperties()
  const [lighter, darker] = [text, behind]
    .map((name) => luminance(channelsOf(name, properties)))
    .sort((first, second) => second - first)
  return ((lighter ?? 0) + FLARE) / ((darker ?? 0) + FLARE)
}

describe('the palette of styles.css', () => {
  it.each([
    ['text', 'background'],
    ['text', 'surface'],
    ['text', 'surface-raised'],
    ['text-secondary', 'background'],
    ['text-secondary', 'surface'],
    ['text-secondary', 'surface-raised'],
    ['gold', 'background'],
    ['gold-light', 'surface'],
    ['gold-light', 'surface-raised'],
    ['gold-dark', 'background'],
    ['background', 'gold'],
    ['danger', 'background'],
    ['gold-light', 'background'],
    ['ink', 'paper'],
    ['ink-soft', 'paper'],
    ['ink-soft', 'paper-shade'],
  ])('should keep --%s readable on --%s', (text, behind) => {
    expect(contrast(text, behind)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
  })

  it('should keep the graphite neutral, with no warm tone', () => {
    const properties = rootProperties()

    for (const name of ['background', 'surface', 'surface-raised', 'border']) {
      const [red = 0, green = 0, blue = 0] = channelsOf(name, properties)
      expect(red, name).toBe(green)
      expect(blue - red, name).toBeGreaterThanOrEqual(0)
    }
  })

  it('should refuse a custom property that is no color', () => {
    expect(() => channelsOf('sans', rootProperties())).toThrow('--sans is not a color')
  })
})
