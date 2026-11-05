import { describe, expect, it } from 'vitest'

import { RemoteKey } from './remote-key.ts'
import {
  advanceSlideshow,
  decodedPhotos,
  openViewer,
  pressInViewer,
  type ViewerState,
} from './slideshow.ts'

const COUNT = 5

function showing(index: number, isPlaying = false): ViewerState {
  return { index, isPlaying }
}

describe('openViewer', () => {
  it('should show the chosen photo, paused', () => {
    expect(openViewer(3, COUNT)).toStrictEqual(showing(3))
  })

  it.each([
    [9, 4],
    [-1, 0],
  ])('should bring the photo %i back to %i', (index, expected) => {
    expect(openViewer(index, COUNT)).toStrictEqual(showing(expected))
  })
})

describe('pressInViewer', () => {
  it('should show the previous and the next photo', () => {
    expect(pressInViewer(showing(2), RemoteKey.Left, COUNT)).toStrictEqual(showing(1))
    expect(pressInViewer(showing(2), RemoteKey.Right, COUNT)).toStrictEqual(showing(3))
  })

  it('should stop at the first and at the last photo', () => {
    expect(pressInViewer(showing(0), RemoteKey.Left, COUNT)).toStrictEqual(showing(0))
    expect(pressInViewer(showing(4), RemoteKey.Right, COUNT)).toStrictEqual(showing(4))
  })

  it('should stay put without photos', () => {
    expect(pressInViewer(showing(0), RemoteKey.Right, 0)).toStrictEqual(showing(0))
    expect(pressInViewer(showing(0), RemoteKey.Left, 0)).toStrictEqual(showing(0))
  })

  it('should keep the slideshow going while the arrows move', () => {
    expect(pressInViewer(showing(2, true), RemoteKey.Right, COUNT)).toStrictEqual(showing(3, true))
  })

  it('should start and pause the slideshow on Enter', () => {
    const playing = pressInViewer(showing(2), RemoteKey.Enter, COUNT)

    expect(playing).toStrictEqual(showing(2, true))
    expect(pressInViewer(playing, RemoteKey.Enter, COUNT)).toStrictEqual(showing(2))
  })

  it.each([RemoteKey.Up, RemoteKey.Down, RemoteKey.Back])('should ignore %s', (key) => {
    const state = showing(2, true)

    expect(pressInViewer(state, key, COUNT)).toBe(state)
  })
})

describe('advanceSlideshow', () => {
  it('should show the next photo', () => {
    expect(advanceSlideshow(showing(1, true), COUNT)).toStrictEqual(showing(2, true))
  })

  it('should start over after the last photo', () => {
    expect(advanceSlideshow(showing(4, true), COUNT)).toStrictEqual(showing(0, true))
  })

  it('should stay on a single photo', () => {
    expect(advanceSlideshow(showing(0, true), 1)).toStrictEqual(showing(0, true))
  })
})

describe('decodedPhotos', () => {
  const PHOTOS = ['a', 'b', 'c', 'd', 'e']

  it('should keep the photo on the screen, the next and the previous one', () => {
    expect(decodedPhotos(PHOTOS, showing(2))).toStrictEqual(['c', 'd', 'b'])
  })

  it('should keep only what exists at the ends while paused', () => {
    expect(decodedPhotos(PHOTOS, showing(0))).toStrictEqual(['a', 'b'])
    expect(decodedPhotos(PHOTOS, showing(4))).toStrictEqual(['e', 'd'])
  })

  it('should load the first photo after the last one while the slideshow loops', () => {
    expect(decodedPhotos(PHOTOS, showing(4, true))).toStrictEqual(['e', 'a', 'd'])
  })

  it('should keep each photo once', () => {
    expect(decodedPhotos(['a', 'b'], showing(1, true))).toStrictEqual(['b', 'a'])
    expect(decodedPhotos(['a'], showing(0, true))).toStrictEqual(['a'])
  })

  it('should keep nothing when there is no photo', () => {
    expect(decodedPhotos([], showing(0))).toStrictEqual([])
  })

  it('should never keep more than three photos', () => {
    PHOTOS.forEach((photo, index) => {
      expect(decodedPhotos(PHOTOS, showing(index, true))).toContain(photo)
      expect(decodedPhotos(PHOTOS, showing(index, true)).length).toBeLessThanOrEqual(3)
    })
  })
})
