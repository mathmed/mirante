import { act, fireEvent, render, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { photos, stubLibrary } from '../../test/library-stub.ts'
import { fakeRemote, type FakeRemote } from '../../test/remote.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { MESSAGES } from './messages.ts'
import { INFO_VISIBLE_MS, Viewer } from './Viewer.tsx'

const PHOTOS = photos('p', 5)
const SLIDESHOW_SECONDS = 8
const SLIDESHOW_MS = SLIDESHOW_SECONDS * 1000
const LIBRARY = stubLibrary({})

interface Shown {
  readonly remote: FakeRemote
  readonly closed: number[]
}

function show(start = 2, list = PHOTOS): Shown {
  const remote = fakeRemote()
  const closed: number[] = []
  render(
    <Viewer
      photos={list}
      start={start}
      library={LIBRARY}
      keys={remote.keys}
      slideshowSeconds={SLIDESHOW_SECONDS}
      onClose={(index) => closed.push(index)}
    />,
  )
  return { remote, closed }
}

function current(): string | null | undefined {
  return document.querySelector('.slide.is-current img')?.getAttribute('src')
}

function preview(id: string): string {
  return `https://images.test/preview/${id}`
}

function wait(ms: number): void {
  void act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function info(): Element {
  const element = document.querySelector('.viewer-info')
  if (element === null) {
    throw new Error('no date and counter')
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

  it('should keep at most three images: the photo, the next and the previous one', () => {
    show()

    const sources = [...document.querySelectorAll('img')].map((image) => image.getAttribute('src'))

    expect(new Set(sources)).toStrictEqual(
      new Set([preview('p-2'), preview('p-3'), preview('p-4')]),
    )
  })

  it('should show the next and the previous photo, stopping at the ends', () => {
    const sut = show(3)

    sut.remote.press(RemoteKey.Right, RemoteKey.Right)
    expect(current()).toBe(preview('p-5'))
    sut.remote.press(RemoteKey.Left)
    expect(current()).toBe(preview('p-4'))
  })

  it('should play the slideshow on Enter, in a loop', () => {
    const sut = show(3)

    sut.remote.press(RemoteKey.Enter)
    expect(info().textContent).toContain(MESSAGES.slideshowPlaying)
    wait(SLIDESHOW_MS - 1)
    expect(current()).toBe(preview('p-4'))
    wait(1)
    expect(current()).toBe(preview('p-5'))
    wait(SLIDESHOW_MS)
    expect(current()).toBe(preview('p-1'))
  })

  it('should load the first photo ahead while the slideshow is on the last one', () => {
    const sut = show(4)

    sut.remote.press(RemoteKey.Enter)

    const sources = [...document.querySelectorAll('img')].map((image) => image.getAttribute('src'))
    expect(new Set(sources)).toStrictEqual(
      new Set([preview('p-1'), preview('p-4'), preview('p-5')]),
    )
  })

  it('should pause the slideshow on Enter', () => {
    const sut = show()

    sut.remote.press(RemoteKey.Enter, RemoteKey.Enter)
    wait(SLIDESHOW_MS * 3)

    expect(current()).toBe(preview('p-3'))
  })

  it('should start the interval over when an arrow moves during the slideshow', () => {
    const sut = show(0)

    sut.remote.press(RemoteKey.Enter)
    wait(SLIDESHOW_MS / 2)
    sut.remote.press(RemoteKey.Right)
    wait(SLIDESHOW_MS - 1)
    expect(current()).toBe(preview('p-2'))
    wait(1)
    expect(current()).toBe(preview('p-3'))
  })

  it('should hide the date and the counter after a while, and show them on each change', () => {
    const sut = show()

    expect(info().className).toBe('viewer-info is-visible')
    wait(INFO_VISIBLE_MS)
    expect(info().className).toBe('viewer-info')
    expect(info().getAttribute('aria-hidden')).toBe('true')
    sut.remote.press(RemoteKey.Right)
    expect(info().className).toBe('viewer-info is-visible')
    expect(info().textContent).toContain('4 de 5')
  })

  it('should close on Back with the photo on the screen', () => {
    const sut = show(1)

    sut.remote.press(RemoteKey.Right, RemoteKey.Right, RemoteKey.Back)

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
    sut.remote.press(RemoteKey.Right)
    expect(current()).toBe(preview('p-4'))
  })

  it('should stay on a single photo', () => {
    const sut = show(0, PHOTOS.slice(0, 1))

    sut.remote.press(RemoteKey.Enter, RemoteKey.Right)
    wait(SLIDESHOW_MS)

    expect(current()).toBe(preview('p-1'))
    expect(document.querySelectorAll('img')).toHaveLength(1)
  })

  it('should ignore Up and Down', () => {
    const sut = show()

    sut.remote.press(RemoteKey.Up, RemoteKey.Down)

    expect(current()).toBe(preview('p-3'))
    expect(sut.closed).toStrictEqual([])
  })

  it('should show nothing for a list without photos, and still close', () => {
    const sut = show(0, [])

    sut.remote.press(RemoteKey.Right, RemoteKey.Back)

    expect(document.querySelectorAll('img')).toHaveLength(0)
    expect(document.querySelector('.viewer-date')?.textContent).toBe('')
    expect(sut.closed).toStrictEqual([0])
  })
})
