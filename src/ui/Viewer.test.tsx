import { act, fireEvent, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { photos } from '../../test/library-stub.ts'
import { current, decoded, preview, showViewer as show, SLIDES } from '../../test/viewer.ts'
import { slideOf } from '../core/presentation.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { MESSAGES } from './messages.ts'
import type { Rounds } from './use-presentation.ts'

const { Left, Right, Enter, Back, Up } = RemoteKey
const SLIDESHOW_MS = 8000
const INTERFACE_MS = 4000

function wait(ms: number): void {
  void act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function info(): Element {
  const element = document.querySelector('.viewer-info')
  if (element === null) {
    throw new Error('no interface')
  }
  return element
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Viewer', () => {
  it('should show the chosen photo in its preview size, with its date and counter', () => {
    show()

    expect(current()).toBe(preview('p-3'))
    expect(info().textContent).toContain('3 de março de 2024')
    expect(info().textContent).toContain('3 de 5')
    expect(info().textContent).toContain(MESSAGES.slideshowPaused)
    expect(screen.getByRole('dialog', { name: '3 de 5' })).toBe(document.activeElement)
  })

  it('should keep at most three images decoded: the photo, the next and the previous one', () => {
    show()

    expect(new Set(decoded())).toStrictEqual(
      new Set([preview('p-2'), preview('p-3'), preview('p-4')]),
    )
  })

  it('should download the photo after the next one without decoding it', () => {
    const detached: string[] = []
    const source = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
    vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (
      this: HTMLImageElement,
      value: string,
    ) {
      if (!this.isConnected) {
        detached.push(value)
      }
      source?.set?.call(this, value)
    })

    show({ start: 1 })

    expect(detached).toContain(preview('p-4'))
    expect(decoded()).not.toContain(preview('p-4'))
  })

  it('should show the next and the previous photo, stopping at the ends', () => {
    const sut = show({ start: 3 })

    sut.remote.press(Right, Right)
    expect(current()).toBe(preview('p-5'))
    sut.remote.press(Left)
    expect(current()).toBe(preview('p-4'))
  })

  it('should play the slideshow on Enter, in a loop', () => {
    const sut = show({ start: 3 })

    sut.remote.press(Enter)
    expect(info().textContent).toContain(MESSAGES.slideshowPlaying)
    wait(SLIDESHOW_MS - 1)
    expect(current()).toBe(preview('p-4'))
    wait(1)
    expect(current()).toBe(preview('p-5'))
    wait(SLIDESHOW_MS)
    expect(current()).toBe(preview('p-1'))
  })

  it('should play from the start when asked to, every interval of the settings', () => {
    show({ start: 0, shouldPlay: true, settings: { intervalSeconds: 3 } })

    wait(3000)

    expect(current()).toBe(preview('p-2'))
  })

  it('should stop on the last photo without a loop', () => {
    show({ start: 3, shouldPlay: true, settings: { shouldLoop: false } })

    wait(SLIDESHOW_MS)
    wait(SLIDESHOW_MS)
    wait(SLIDESHOW_MS)

    expect(current()).toBe(preview('p-5'))
    expect(info().textContent).toContain(MESSAGES.slideshowPaused)
  })

  it('should load the first photo ahead while the slideshow is on the last one', () => {
    show({ start: 4, shouldPlay: true })

    expect(new Set(decoded())).toStrictEqual(
      new Set([preview('p-1'), preview('p-4'), preview('p-5')]),
    )
  })

  it('should play the next round the rounds give, and tell them when each starts', () => {
    const started: number[] = []
    const next = photos('n', 2).map(slideOf)
    const rounds: Rounds = {
      after: ({ round }) => (round === 0 ? next : undefined),
      onStart: (round) => started.push(round),
      isGrowing: false,
      onShow: () => undefined,
    }
    show({ start: 4, shouldPlay: true, rounds })

    wait(SLIDESHOW_MS)
    expect(current()).toBe(preview('n-1'))
    wait(SLIDESHOW_MS * 2)

    expect(current()).toBe(preview('n-2'))
    expect(started).toStrictEqual([0, 1])
  })

  it('should pause the slideshow on Enter', () => {
    const sut = show()

    sut.remote.press(Enter, Enter)
    wait(SLIDESHOW_MS * 3)

    expect(current()).toBe(preview('p-3'))
  })

  it('should start the interval over when an arrow moves during the slideshow', () => {
    const sut = show({ start: 0 })

    sut.remote.press(Enter)
    wait(SLIDESHOW_MS / 2)
    sut.remote.press(Right)
    wait(SLIDESHOW_MS - 1)
    expect(current()).toBe(preview('p-2'))
    wait(1)
    expect(current()).toBe(preview('p-3'))
  })

  it('should hide the interface after the time of the settings, and show it on each change', () => {
    const sut = show({ settings: { hideInterfaceSeconds: 6 } })

    expect(info().className).toBe('viewer-info is-visible')
    wait(INTERFACE_MS)
    expect(info().className).toBe('viewer-info is-visible')
    wait(2000)
    expect(info().className).toBe('viewer-info')
    expect(info().getAttribute('aria-hidden')).toBe('true')
    sut.remote.press(Right)
    expect(info().className).toBe('viewer-info is-visible')
    expect(info().textContent).toContain('4 de 5')
  })

  it('should leave out the date and the counter when the settings say so', () => {
    show({ settings: { shouldShowDate: false, shouldShowCounter: false } })

    expect(document.querySelector('.viewer-date')).toBeNull()
    expect(document.querySelector('.viewer-counter')).toBeNull()
    expect(info().textContent).toBe(MESSAGES.slideshowPaused)
  })

  it('should close on Back with the photo on the screen', () => {
    const sut = show({ start: 1 })

    sut.remote.press(Right, Right, Back)

    expect(sut.closed).toStrictEqual([3])
  })

  it('should explain a preview that fails, and keep moving', () => {
    const sut = show()

    const failing = document.querySelector('.slide.is-current img')
    if (failing === null) {
      throw new Error('no photo on the screen')
    }
    fireEvent.error(failing)
    expect(screen.getByText(MESSAGES.previewUnavailable)).toBeTruthy()
    sut.remote.press(Right)
    expect(current()).toBe(preview('p-4'))
  })

  it('should stay on a single photo', () => {
    const sut = show({ start: 0, slides: SLIDES.slice(0, 1) })

    sut.remote.press(Enter, Right)
    wait(SLIDESHOW_MS)

    expect(current()).toBe(preview('p-1'))
    expect(decoded()).toHaveLength(1)
  })

  it('should ignore Up', () => {
    const sut = show()

    sut.remote.press(Up)

    expect(current()).toBe(preview('p-3'))
    expect(sut.closed).toStrictEqual([])
  })

  it('should show nothing for a list without photos, and still close', () => {
    const sut = show({ start: 0, slides: [] })

    sut.remote.press(Right, Back)

    expect(decoded()).toHaveLength(0)
    expect(document.querySelector('.viewer-date')?.textContent).toBe('')
    expect(sut.closed).toStrictEqual([0])
  })

  it('should draw a line that fills up in the interval of the slideshow, a new one for each photo', () => {
    const sut = show({ start: 0 })
    expect(document.querySelector('.viewer-progress')).toBeNull()

    sut.remote.press(Enter)
    const first = document.querySelector<HTMLElement>('.viewer-progress-bar')
    expect(first?.style.animationDuration).toBe('8s')
    wait(SLIDESHOW_MS)
    const second = document.querySelector('.viewer-progress-bar')

    expect(second).not.toBeNull()
    expect(second).not.toBe(first)
    sut.remote.press(Enter)
    expect(document.querySelector('.viewer-progress')).toBeNull()
  })

  it('should darken the edges of the photo with a vignette', () => {
    show()

    expect(document.querySelector('.viewer-vignette')).not.toBeNull()
  })
})
