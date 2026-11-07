import { describe, expect, it } from 'vitest'

import { photos } from '../../test/library-stub.ts'
import {
  Direction,
  pressInPresentation,
  slideOf,
  startPresentation,
  withoutSlides,
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
