import { describe, expect, it } from 'vitest'

import { photos } from '../../test/library-stub.ts'
import {
  Direction,
  pressInPresentation,
  slideOf,
  startPresentation,
  withoutSlides,
  withSlidesBack,
} from './presentation.ts'
import { RemoteKey } from './remote-key.ts'

const SLIDES = photos('p', 5).map(slideOf)

function keysOf(state: ReturnType<typeof startPresentation>): readonly string[] {
  return state.slides.map((slide) => slide.key)
}

describe('withoutSlides', () => {
  it('should show the next photo in place of the one deleted on the screen', () => {
    const sut = withoutSlides(startPresentation(SLIDES, 2, false), new Set(['p-3']))

    expect(keysOf(sut)).toStrictEqual(['p-1', 'p-2', 'p-4', 'p-5'])
    expect(sut.index).toBe(2)
    expect(sut.slides[sut.index]?.key).toBe('p-4')
  })

  it('should keep the photo on the screen when photos before it leave', () => {
    const sut = withoutSlides(startPresentation(SLIDES, 3, false), new Set(['p-1', 'p-2']))

    expect(sut.slides[sut.index]?.key).toBe('p-4')
    expect(sut.index).toBe(1)
  })

  it('should show the photo before when the last one leaves', () => {
    const sut = withoutSlides(startPresentation(SLIDES, 4, false), new Set(['p-5']))

    expect(sut.index).toBe(3)
    expect(sut.slides[sut.index]?.key).toBe('p-4')
  })

  it('should end without slides when every photo leaves', () => {
    const sut = withoutSlides(
      startPresentation(SLIDES, 1, true),
      new Set(SLIDES.map((slide) => slide.key)),
    )

    expect(sut.slides).toStrictEqual([])
    expect(sut.index).toBe(0)
    expect(sut.isPlaying).toBe(true)
  })

  it('should drop the photo leaving the screen, so that no transition shows a deleted photo', () => {
    const moved = pressInPresentation(startPresentation(SLIDES, 1, false), RemoteKey.Right)

    const sut = withoutSlides(moved, new Set(['p-2']))

    expect(moved.leaving?.key).toBe('p-2')
    expect(sut.leaving).toBeUndefined()
    expect(sut.direction).toBe(Direction.Forward)
    expect(sut.round).toBe(0)
  })

  it('should change nothing when none of its photos leave', () => {
    const state = startPresentation(SLIDES, 1, false)

    expect(withoutSlides(state, new Set(['other']))).toBe(state)
    expect(withoutSlides(state, new Set())).toBe(state)
  })
})

describe('withSlidesBack', () => {
  const left = SLIDES.filter((slide) => slide.key !== 'p-2')

  it('should put the photos back in their place, the photo on the screen kept', () => {
    const shown = pressInPresentation(startPresentation(left, 0, false), RemoteKey.Right)

    const sut = withSlidesBack(shown, SLIDES)

    expect(keysOf(sut)).toStrictEqual(['p-1', 'p-2', 'p-3', 'p-4', 'p-5'])
    expect(sut.index).toBe(2)
    expect(sut.slides[sut.index]?.key).toBe('p-3')
    expect(sut.leaving).toBeUndefined()
  })

  it('should change nothing when no photo came back', () => {
    const state = startPresentation(left, 1, false)

    expect(withSlidesBack(state, left)).toBe(state)
    expect(withSlidesBack(state, left.slice(1))).toBe(state)
  })

  it('should change nothing when the slides are others, or of a later round', () => {
    const state = startPresentation(left, 1, false)
    const others = [...photos('q', 5), ...photos('r', 1)].map(slideOf)

    expect(withSlidesBack(state, others)).toBe(state)
    expect(withSlidesBack({ ...state, round: 1 }, SLIDES)).toStrictEqual({ ...state, round: 1 })
  })

  it('should change nothing without slides', () => {
    const state = startPresentation([], 0, false)

    expect(withSlidesBack(state, SLIDES)).toBe(state)
  })
})
