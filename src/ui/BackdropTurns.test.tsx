import { act, fireEvent, render } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BackdropPhoto } from './Backdrop.tsx'
import { BACKDROP_TURN_MS, BackdropTurns } from './BackdropTurns.tsx'

function photo(name: string): BackdropPhoto {
  return { url: `https://images.test/preview/${name}`, caption: `Há ${name}` }
}

const PHOTOS = [photo('a'), photo('b'), photo('c')]

function shown(): readonly (string | null)[] {
  return [...document.querySelectorAll('.backdrop-photo')].map((image) => image.getAttribute('src'))
}

function captions(): readonly (string | null)[] {
  return [...document.querySelectorAll('.backdrop-caption')].map((caption) => caption.textContent)
}

function nextTurn(): void {
  void act(() => {
    vi.advanceTimersByTime(BACKDROP_TURN_MS)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BackdropTurns', () => {
  it('should show nothing without photos', () => {
    render(<BackdropTurns photos={[]} />)
    nextTurn()

    expect(shown()).toStrictEqual([])
  })

  it('should keep a single photo for good', () => {
    render(<BackdropTurns photos={[photo('a')]} />)
    nextTurn()
    nextTurn()

    expect(shown()).toStrictEqual([photo('a').url])
  })

  it('should start with the first photo, and wait its turn before the next', () => {
    render(<BackdropTurns photos={PHOTOS} />)

    expect(shown()).toStrictEqual([photo('a').url])
    void act(() => {
      vi.advanceTimersByTime(BACKDROP_TURN_MS - 1)
    })
    expect(shown()).toStrictEqual([photo('a').url])
  })

  it('should fade the next photo in over the one before, with its caption', () => {
    render(<BackdropTurns photos={PHOTOS} />)
    const first = document.querySelector('.backdrop-photo')
    if (first === null) {
      throw new Error('no photo behind the screen')
    }
    fireEvent.load(first)

    nextTurn()

    expect(shown()).toStrictEqual([photo('a').url, photo('b').url])
    expect(captions()).toStrictEqual(['Há a', 'Há b'])
    const layers = [...document.querySelectorAll('.backdrop')].map((layer) => layer.className)
    expect(layers).toStrictEqual(['backdrop is-shown', 'backdrop'])
  })

  it('should keep two photos in the page at most, and start over after the last', () => {
    render(<BackdropTurns photos={PHOTOS} />)

    nextTurn()
    nextTurn()
    expect(shown()).toStrictEqual([photo('b').url, photo('c').url])
    nextTurn()
    expect(shown()).toStrictEqual([photo('c').url, photo('a').url])
  })

  it('should stop taking turns once off the screen', () => {
    const { unmount } = render(<BackdropTurns photos={PHOTOS} />)
    nextTurn()

    unmount()
    vi.advanceTimersByTime(BACKDROP_TURN_MS)

    expect(vi.getTimerCount()).toBe(0)
  })
})
