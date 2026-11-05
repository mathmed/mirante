import { act } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { preview, showViewer } from '../../test/viewer.ts'
import { RemoteKey } from '../core/remote-key.ts'

const { Left, Right, Enter } = RemoteKey

function slideOf(id: string): HTMLElement {
  const slide = document.querySelector(`.slide img[src="${preview(id)}"]`)?.parentElement
  if (slide === null || slide === undefined) {
    throw new Error(`no slide of ${id}`)
  }
  return slide
}

function classesOf(id: string): string {
  return slideOf(id).className
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Slides', () => {
  it('should crossfade by default, in a second', () => {
    showViewer()

    expect(classesOf('p-3')).toBe('slide slide-fade is-current')
    expect(classesOf('p-2')).toBe('slide slide-fade is-before')
    expect(classesOf('p-4')).toBe('slide slide-fade is-after')
    expect(slideOf('p-3').style.transitionDuration).toBe('1000ms')
  })

  it('should cut from a photo to the next at once', () => {
    showViewer({ settings: { transition: 'cut' } })

    expect(classesOf('p-3')).toBe('slide slide-cut is-current')
    expect(slideOf('p-3').style.transitionDuration).toBe('0ms')
  })

  it('should slide the photo leaving the screen out the way of the move', () => {
    const sut = showViewer({ settings: { transition: 'slide' } })

    sut.remote.press(Right)
    expect(classesOf('p-3')).toBe('slide slide-slide is-before is-leaving')
    expect(classesOf('p-4')).toBe('slide slide-slide is-current')
    expect(slideOf('p-4').style.transitionDuration).toBe('900ms')
    sut.remote.press(Left)

    expect(classesOf('p-4')).toBe('slide slide-slide is-after is-leaving')
  })

  it('should zoom slowly into the photo on the screen, the way its id decides, and on as it leaves', () => {
    const sut = showViewer({ settings: { transition: 'ken-burns', intervalSeconds: 10 } })

    expect(classesOf('p-3')).toBe(
      'slide slide-ken-burns is-current is-zooming zoom-out-right-gentle',
    )
    expect(classesOf('p-4')).toBe('slide slide-ken-burns is-after')
    expect(slideOf('p-3').style.animationDuration).toBe('13000ms')
    sut.remote.press(Right)

    expect(classesOf('p-3')).toBe(
      'slide slide-ken-burns is-before is-leaving is-zooming zoom-out-right-gentle',
    )
    expect(classesOf('p-4')).toBe(
      'slide slide-ken-burns is-current is-zooming zoom-in-right-gentle',
    )
  })

  it('should zoom more with the normal intensity', () => {
    showViewer({ settings: { transition: 'ken-burns', zoom: 'normal' } })

    expect(classesOf('p-3')).toContain('zoom-out-right-normal')
  })

  it('should fade without a zoom when the effects are reduced', () => {
    showViewer({ settings: { transition: 'ken-burns', shouldReduceEffects: true } })

    expect(classesOf('p-3')).toBe('slide slide-fade is-current')
  })

  it('should hold the zoom while the slideshow is paused', () => {
    const sut = showViewer({ settings: { transition: 'ken-burns' } })
    const viewer = document.querySelector('.viewer')

    expect(viewer?.className).toBe('viewer')
    sut.remote.press(Enter)
    expect(viewer?.className).toBe('viewer is-playing')
    void act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(viewer?.className).toBe('viewer is-playing')
  })
})
