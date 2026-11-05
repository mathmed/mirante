import { describe, expect, it } from 'vitest'

import {
  effectiveTransition,
  interfaceMs,
  isZooming,
  slideMs,
  transitionMs,
  zoomMs,
  ZoomPath,
  zoomPathOf,
} from './presentation-effects.ts'
import { DEFAULT_PRESENTATION, Transition } from './presentation-settings.ts'

const KEN_BURNS = { ...DEFAULT_PRESENTATION, transition: Transition.KenBurns }

describe('effectiveTransition', () => {
  it.each(Object.values(Transition))('should play the transition chosen, %s', (transition) => {
    expect(effectiveTransition({ ...DEFAULT_PRESENTATION, transition })).toBe(transition)
  })

  it.each(Object.values(Transition))(
    'should fade instead of %s when the effects are reduced',
    (transition) => {
      const settings = { ...DEFAULT_PRESENTATION, transition, shouldReduceEffects: true }

      expect(effectiveTransition(settings)).toBe(Transition.Fade)
    },
  )
})

describe('isZooming', () => {
  it('should zoom with the slow zoom only', () => {
    expect(isZooming(KEN_BURNS)).toBe(true)
    expect(isZooming({ ...DEFAULT_PRESENTATION, transition: Transition.Slide })).toBe(false)
  })

  it('should not zoom when the effects are reduced', () => {
    expect(isZooming({ ...KEN_BURNS, shouldReduceEffects: true })).toBe(false)
  })
})

describe('transitionMs', () => {
  it.each([
    [Transition.Cut, 0],
    [Transition.Fade, 1000],
    [Transition.Slide, 900],
    [Transition.KenBurns, 1500],
  ])('should play %s in %i ms', (transition, ms) => {
    expect(transitionMs(transition)).toBe(ms)
  })
})

describe('zoomPathOf', () => {
  it.each([
    ['p-1', ZoomPath.OutToLeft],
    ['p-2', ZoomPath.InToLeft],
    ['p-3', ZoomPath.OutToRight],
    ['p-4', ZoomPath.InToRight],
  ])('should drift %s the same way every time: %s', (photoId, path) => {
    expect(zoomPathOf(photoId)).toBe(path)
    expect(zoomPathOf(photoId)).toBe(path)
  })

  it('should give a path to a photo without an id', () => {
    expect(zoomPathOf('')).toBe(ZoomPath.OutToLeft)
  })
})

describe('durations', () => {
  it('should show each photo for the interval', () => {
    expect(slideMs({ ...DEFAULT_PRESENTATION, intervalSeconds: 12 })).toBe(12_000)
  })

  it('should zoom through the interval and both crossfades', () => {
    expect(zoomMs({ ...KEN_BURNS, intervalSeconds: 10 })).toBe(13_000)
  })

  it('should hide the interface after its time', () => {
    expect(interfaceMs({ ...DEFAULT_PRESENTATION, hideInterfaceSeconds: 6 })).toBe(6000)
  })
})
