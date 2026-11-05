import { type PresentationSettings, Transition } from './presentation-settings.ts'

// How the viewer moves from a photo to the next: the transition it plays, how long it lasts and,
// for the slow zoom, which way each photo drifts. The viewer animates transform and opacity alone.

export const ZoomPath = {
  InToLeft: 'in-left',
  InToRight: 'in-right',
  OutToLeft: 'out-left',
  OutToRight: 'out-right',
} as const

export type ZoomPath = (typeof ZoomPath)[keyof typeof ZoomPath]

const FADE_MS = 1000
const SLIDE_MS = 900
const KEN_BURNS_MS = 1500
// The slow zoom goes on through the crossfade into the photo and the one out of it.
const CROSSFADES_PER_ZOOM = 2

// Two bits of the hash of the id: whether the photo zooms out, and whether it drifts right.
const ZOOM_OUT_BIT = 1
const TO_RIGHT_BIT = 2

const MS_PER_SECOND = 1000
const FNV_OFFSET = 2_166_136_261
const FNV_PRIME = 16_777_619

// Reducing the effects, for a slow TV, leaves a plain fade, whatever the transition chosen.
export function effectiveTransition(settings: PresentationSettings): Transition {
  return settings.shouldReduceEffects ? Transition.Fade : settings.transition
}

export function transitionMs(transition: Transition): number {
  switch (transition) {
    case Transition.Fade:
      return FADE_MS
    case Transition.Slide:
      return SLIDE_MS
    case Transition.KenBurns:
      return KEN_BURNS_MS
    default:
      return 0
  }
}

export function isZooming(settings: PresentationSettings): boolean {
  return effectiveTransition(settings) === Transition.KenBurns
}

// The same photo always drifts the same way, whatever the TV and the order it comes in.
export function zoomPathOf(photoId: string): ZoomPath {
  const hash = hashOf(photoId)
  const zoom = (hash & ZOOM_OUT_BIT) === 0 ? 'in' : 'out'
  const drift = (hash & TO_RIGHT_BIT) === 0 ? 'left' : 'right'
  return `${zoom}-${drift}` as const
}

// The zoom lasts the time on the screen and the crossfades into and out of it, so that the photo
// never stands still.
export function zoomMs(settings: PresentationSettings): number {
  return slideMs(settings) + CROSSFADES_PER_ZOOM * transitionMs(Transition.KenBurns)
}

export function slideMs(settings: PresentationSettings): number {
  return settings.intervalSeconds * MS_PER_SECOND
}

export function interfaceMs(settings: PresentationSettings): number {
  return settings.hideInterfaceSeconds * MS_PER_SECOND
}

// FNV-1a over the code units of the text, as an unsigned 32-bit number.
function hashOf(text: string): number {
  let hash = FNV_OFFSET
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME)
  }
  return hash >>> 0
}
