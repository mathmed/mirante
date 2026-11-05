// Landscapes drawn from a seed, standing in for photos in the screenshots of the docs: a sky
// fading to the horizon, a sun, hills one behind the other and, sometimes, water. The same seed and
// size always give the same PNG.
import { BYTES_PER_PIXEL, encodePng, type Image } from '../scripts/packaging/png.ts'

type Rgb = readonly [number, number, number]

interface Palette {
  readonly skyTop: Rgb
  readonly skyHorizon: Rgb
  readonly sun: Rgb
  // From the farthest to the nearest.
  readonly hills: readonly [Rgb, ...Rgb[]]
  readonly water: Rgb
}

const PALETTES: readonly [Palette, ...Palette[]] = [
  {
    skyTop: [43, 29, 74],
    skyHorizon: [242, 158, 76],
    sun: [255, 222, 160],
    hills: [
      [122, 62, 72],
      [74, 36, 52],
      [36, 22, 34],
    ],
    water: [92, 48, 70],
  },
  {
    skyTop: [58, 120, 186],
    skyHorizon: [206, 228, 240],
    sun: [255, 250, 230],
    hills: [
      [104, 150, 96],
      [64, 112, 60],
      [38, 76, 40],
    ],
    water: [44, 110, 143],
  },
  {
    skyTop: [18, 50, 74],
    skyHorizon: [233, 184, 114],
    sun: [255, 230, 170],
    hills: [
      [64, 92, 90],
      [36, 62, 62],
      [16, 36, 36],
    ],
    water: [30, 70, 84],
  },
  {
    skyTop: [110, 74, 47],
    skyHorizon: [245, 209, 138],
    sun: [255, 244, 210],
    hills: [
      [160, 120, 62],
      [122, 90, 42],
      [74, 52, 24],
    ],
    water: [120, 96, 60],
  },
  {
    skyTop: [126, 178, 217],
    skyHorizon: [240, 230, 214],
    sun: [255, 255, 240],
    hills: [
      [140, 160, 176],
      [96, 120, 138],
      [60, 80, 96],
    ],
    water: [70, 130, 160],
  },
]

const OPAQUE = 255
const TWO_PI = 2 * Math.PI
const BLACK: Rgb = [0, 0, 0]

interface Wave {
  readonly base: number
  readonly amplitude: number
  readonly frequency: number
  readonly phase: number
}

interface Scene {
  readonly palette: Palette
  // From the top of the image, in fractions of its height, like every vertical position here.
  readonly horizon: number
  readonly hasWater: boolean
  readonly sun: { readonly x: number; readonly y: number; readonly radius: number }
  readonly waves: readonly Wave[]
}

// A point of the image, in fractions of its width (u) and height (v), and the tops of the hills
// in its column.
interface Sample {
  readonly u: number
  readonly v: number
  readonly aspect: number
  readonly tops: readonly number[]
}

export function scenePng(seed: number, width: number, height: number): Uint8Array {
  return encodePng(drawScene(sceneOf(randomFrom(seed)), width, height))
}

function sceneOf(random: () => number): Scene {
  const palette = PALETTES.at(Math.floor(random() * PALETTES.length)) ?? PALETTES[0]
  const horizon = 0.55 + random() * 0.15
  return {
    palette,
    horizon,
    hasWater: random() < 0.4,
    sun: {
      x: 0.2 + random() * 0.6,
      y: horizon - 0.1 - random() * 0.2,
      radius: 0.04 + random() * 0.04,
    },
    waves: Array.from(palette.hills.keys(), (layer) => ({
      base: horizon - 0.12 + layer * 0.07 + random() * 0.04,
      amplitude: 0.03 + random() * 0.05,
      frequency: 1 + random() * 3,
      phase: random() * TWO_PI,
    })),
  }
}

function drawScene(scene: Scene, width: number, height: number): Image {
  const pixels = new Uint8Array(width * height * BYTES_PER_PIXEL)
  for (let x = 0; x < width; x += 1) {
    const u = x / width
    const tops = scene.waves.map((wave) => hillTop(wave, u))
    for (let y = 0; y < height; y += 1) {
      const color = colorAt(scene, { u, v: y / height, aspect: width / height, tops })
      pixels.set([...color, OPAQUE], (y * width + x) * BYTES_PER_PIXEL)
    }
  }
  return { width, height, pixels }
}

function hillTop(wave: Wave, u: number): number {
  const angle = wave.frequency * TWO_PI * u + wave.phase
  return wave.base - wave.amplitude * (Math.sin(angle) + Math.sin(angle * 3.7 + wave.phase) / 3)
}

function colorAt(scene: Scene, sample: Sample): Rgb {
  if (scene.hasWater && sample.v > scene.horizon) {
    return waterAt(scene, sample)
  }
  const layer = sample.tops.findLastIndex((top) => sample.v >= top)
  return layer === -1 ? skyAt(scene, sample) : hillAt(scene, sample, layer)
}

// The nearest hill under the point, darker away from its top.
function hillAt(scene: Scene, sample: Sample, layer: number): Rgb {
  const hill = scene.palette.hills.at(layer) ?? scene.palette.hills[0]
  const depth = sample.v - (sample.tops.at(layer) ?? 0)
  return mix(hill, BLACK, Math.min(0.35, depth * 0.8))
}

// The sky, mirrored and tinted by the water, darker further down.
function waterAt(scene: Scene, sample: Sample): Rgb {
  const { horizon, palette } = scene
  const depth = (sample.v - horizon) / (1 - horizon)
  const reflected = skyAt(scene, { ...sample, v: horizon - (sample.v - horizon) * 0.6 })
  return mix(mix(reflected, palette.water, 0.55), palette.hills[0], depth * 0.5)
}

function skyAt({ palette, sun }: Scene, { u, v, aspect }: Sample): Rgb {
  const base = mix(palette.skyTop, palette.skyHorizon, Math.min(1, Math.max(0, v / 0.7)))
  const distance = Math.hypot((u - sun.x) * aspect, v - sun.y)
  if (distance < sun.radius) {
    return palette.sun
  }
  const glow = Math.max(0, 1 - (distance - sun.radius) / (sun.radius * 5))
  return mix(base, palette.sun, glow * glow * 0.6)
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ]
}

// A small linear congruential generator: the same seed always draws the same scene.
function randomFrom(seed: number): () => number {
  const start = seed >>> 0
  let state = start === 0 ? 1 : start
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_00_00_00_00
  }
}
