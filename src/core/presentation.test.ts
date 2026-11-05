import { describe, expect, it } from 'vitest'

import { photos } from '../../test/library-stub.ts'
import type { Photo } from './photo-library.ts'
import { PlaybackOrder } from './presentation-settings.ts'
import {
  advancePresentation,
  currentSlide,
  decodedSlides,
  Direction,
  nextRoundOf,
  placeOf,
  playlistOf,
  type PresentationState,
  pressInPresentation,
  type Slide,
  slideOf,
  SlidePlace,
  slidesAhead,
  startPresentation,
  type Upcoming,
} from './presentation.ts'
import { RemoteKey } from './remote-key.ts'

const PHOTOS = photos('p', 5)
const SLIDES = PHOTOS.map(slideOf)
const NEXT_ROUND = photos('n', 3).map(slideOf)
const LOOPING: Upcoming = { shouldLoop: true, nextRound: NEXT_ROUND }
const ONCE: Upcoming = { shouldLoop: false, nextRound: NEXT_ROUND }

function keysOf(slides: readonly Slide[]): readonly string[] {
  return slides.map((slide) => slide.key)
}

function slideAt(slides: readonly Slide[], index: number): Slide {
  const [slide] = slides.slice(index, index + 1)
  if (slide === undefined) {
    throw new Error(`no slide ${String(index)}`)
  }
  return slide
}

function at(index: number, isPlaying = true): PresentationState {
  return startPresentation(SLIDES, index, isPlaying)
}

describe('slideOf', () => {
  it('should hold one photo, under its id', () => {
    const [photo] = PHOTOS as [Photo]

    expect(slideOf(photo)).toStrictEqual({ key: 'p-1', photos: [photo] })
  })
})

describe('playlistOf', () => {
  const MIXED = [PHOTOS[2], PHOTOS[0], PHOTOS[4], PHOTOS[1], PHOTOS[3]] as readonly Photo[]

  it('should play the photos from the oldest', () => {
    expect(keysOf(playlistOf(MIXED, PlaybackOrder.OldestFirst, 1))).toStrictEqual([
      'p-1',
      'p-2',
      'p-3',
      'p-4',
      'p-5',
    ])
  })

  it('should play the photos from the newest', () => {
    expect(keysOf(playlistOf(MIXED, PlaybackOrder.NewestFirst, 1))).toStrictEqual([
      'p-5',
      'p-4',
      'p-3',
      'p-2',
      'p-1',
    ])
  })

  it('should play the photos in the random order of the seed, whatever order they came in', () => {
    const sut = playlistOf(MIXED, PlaybackOrder.Random, 1)

    expect(keysOf(sut)).toStrictEqual(['p-4', 'p-1', 'p-3', 'p-5', 'p-2'])
    expect(sut).toStrictEqual(playlistOf(PHOTOS, PlaybackOrder.Random, 1))
    expect(keysOf(playlistOf(PHOTOS, PlaybackOrder.Random, 2))).not.toStrictEqual(keysOf(sut))
  })

  it.each(Object.values(PlaybackOrder))('should play each photo once (%s)', (order) => {
    const twice = [...PHOTOS, ...PHOTOS]

    expect(
      [...keysOf(playlistOf(twice, order, 3))].sort((first, second) => first.localeCompare(second)),
    ).toStrictEqual(keysOf(SLIDES))
  })
})

describe('nextRoundOf', () => {
  it('should draw a new random order for the next round', () => {
    const first = playlistOf(PHOTOS, PlaybackOrder.Random, 1)

    const sut = nextRoundOf(PHOTOS, PlaybackOrder.Random, { seed: 1, number: 1, last: undefined })

    expect(keysOf(sut)).toStrictEqual(['p-5', 'p-1', 'p-2', 'p-3', 'p-4'])
    expect(keysOf(sut)).not.toStrictEqual(keysOf(first))
  })

  it('should play the same order by date again', () => {
    const last = SLIDES[4]

    expect(
      nextRoundOf(PHOTOS, PlaybackOrder.OldestFirst, { seed: 1, number: 1, last }),
    ).toStrictEqual(SLIDES)
  })

  it('should never start the round on the photo the last one ended on', () => {
    const last = SLIDES[4]

    const sut = nextRoundOf(PHOTOS, PlaybackOrder.Random, { seed: 1, number: 1, last })

    expect(keysOf(sut)).toStrictEqual(['p-1', 'p-2', 'p-3', 'p-4', 'p-5'])
  })

  it('should play a single photo again', () => {
    const single = PHOTOS.slice(0, 1)

    expect(
      keysOf(nextRoundOf(single, PlaybackOrder.Random, { seed: 1, number: 1, last: SLIDES[0] })),
    ).toStrictEqual(['p-1'])
  })

  it('should have no round without photos', () => {
    expect(
      nextRoundOf([], PlaybackOrder.Random, { seed: 1, number: 1, last: undefined }),
    ).toStrictEqual([])
  })
})

describe('startPresentation', () => {
  it('should start on the chosen slide, nothing leaving', () => {
    expect(startPresentation(SLIDES, 2, false)).toStrictEqual({
      slides: SLIDES,
      index: 2,
      round: 0,
      isPlaying: false,
      direction: Direction.Forward,
      leaving: undefined,
    })
  })

  it.each([
    [-1, 0],
    [9, 4],
  ])('should start on a slide that exists: %i becomes %i', (start, index) => {
    expect(startPresentation(SLIDES, start, true).index).toBe(index)
  })

  it('should start on nothing without slides', () => {
    const sut = startPresentation([], 0, true)

    expect(sut.index).toBe(0)
    expect(currentSlide(sut)).toBeUndefined()
  })
})

describe('pressInPresentation', () => {
  it('should move to the next and the previous slide, the one on the screen leaving it', () => {
    const forward = pressInPresentation(at(2), RemoteKey.Right)
    const backward = pressInPresentation(at(2), RemoteKey.Left)

    expect(forward).toMatchObject({ index: 3, direction: Direction.Forward, leaving: SLIDES[2] })
    expect(backward).toMatchObject({ index: 1, direction: Direction.Backward, leaving: SLIDES[2] })
  })

  it('should stop at the first and the last slide, changing nothing', () => {
    const first = at(0)
    const last = at(4)

    expect(pressInPresentation(first, RemoteKey.Left)).toBe(first)
    expect(pressInPresentation(last, RemoteKey.Right)).toBe(last)
  })

  it('should start and pause on Enter', () => {
    const sut = pressInPresentation(at(1, false), RemoteKey.Enter)

    expect(sut.isPlaying).toBe(true)
    expect(pressInPresentation(sut, RemoteKey.Enter).isPlaying).toBe(false)
  })

  it.each([RemoteKey.Up, RemoteKey.Down, RemoteKey.Back])('should ignore %s', (key) => {
    const sut = at(1)

    expect(pressInPresentation(sut, key)).toBe(sut)
  })
})

describe('advancePresentation', () => {
  it('should move to the next slide', () => {
    expect(advancePresentation(at(1), LOOPING)).toStrictEqual({
      ...at(1),
      index: 2,
      leaving: SLIDES[1],
    })
  })

  it('should start the next round after the last slide, in a loop', () => {
    expect(advancePresentation(at(4), LOOPING)).toStrictEqual({
      slides: NEXT_ROUND,
      index: 0,
      round: 1,
      isPlaying: true,
      direction: Direction.Forward,
      leaving: SLIDES[4],
    })
  })

  it('should wait on the last slide while the next round loads', () => {
    const sut = at(4)

    expect(advancePresentation(sut, { shouldLoop: true, nextRound: undefined })).toBe(sut)
    expect(advancePresentation(sut, { shouldLoop: true, nextRound: [] })).toBe(sut)
  })

  it('should pause on the last slide without a loop', () => {
    expect(advancePresentation(at(4), ONCE)).toStrictEqual({ ...at(4), isPlaying: false })
  })

  it('should move forward after a step back', () => {
    const back = pressInPresentation(at(3), RemoteKey.Left)

    expect(advancePresentation(back, ONCE)).toMatchObject({
      index: 3,
      direction: Direction.Forward,
      leaving: SLIDES[2],
    })
  })
})

describe('slidesAhead', () => {
  it('should give the next two slides', () => {
    expect(keysOf(slidesAhead(at(1), LOOPING))).toStrictEqual(['p-3', 'p-4'])
  })

  it('should go on into the next round while it plays in a loop', () => {
    expect(keysOf(slidesAhead(at(3), LOOPING))).toStrictEqual(['p-5', 'n-1'])
    expect(keysOf(slidesAhead(at(4), LOOPING))).toStrictEqual(['n-1', 'n-2'])
  })

  it('should stop at the last slide while paused, or without a loop', () => {
    expect(keysOf(slidesAhead(at(4, false), LOOPING))).toStrictEqual([])
    expect(keysOf(slidesAhead(at(3), ONCE))).toStrictEqual(['p-5'])
  })

  it('should give the slides there are while the next round loads', () => {
    expect(keysOf(slidesAhead(at(4), { shouldLoop: true, nextRound: undefined }))).toStrictEqual([])
  })
})

describe('decodedSlides', () => {
  it('should keep the slide on the screen, the next and the previous one', () => {
    const sut = at(2)

    expect(keysOf(decodedSlides(sut, slidesAhead(sut, LOOPING)))).toStrictEqual([
      'p-3',
      'p-4',
      'p-2',
    ])
  })

  it('should keep the slide leaving the screen before the next one', () => {
    const sut = pressInPresentation(at(2), RemoteKey.Right)

    expect(keysOf(decodedSlides(sut, slidesAhead(sut, LOOPING)))).toStrictEqual([
      'p-4',
      'p-3',
      'p-5',
    ])
  })

  it('should keep the last slide of the round leaving the first of the next', () => {
    const sut = advancePresentation(at(4), LOOPING)

    expect(keysOf(decodedSlides(sut, slidesAhead(sut, LOOPING)))).toStrictEqual([
      'n-1',
      'p-5',
      'n-2',
    ])
  })

  it('should keep a slide once, and never more than three', () => {
    const sut = pressInPresentation(at(2), RemoteKey.Left)
    const decoded = decodedSlides(sut, slidesAhead(sut, LOOPING))

    expect(keysOf(decoded)).toStrictEqual(['p-2', 'p-3', 'p-1'])
  })

  it('should keep nothing without slides', () => {
    expect(decodedSlides(startPresentation([], 0, true), [])).toStrictEqual([])
  })
})

describe('placeOf', () => {
  it('should place the slide on the screen, the previous before it and the next after it', () => {
    const sut = at(2)

    expect([1, 2, 3].map((index) => placeOf(sut, slideAt(SLIDES, index)))).toStrictEqual([
      SlidePlace.Before,
      SlidePlace.Current,
      SlidePlace.After,
    ])
  })

  it('should send the slide leaving the screen the way of the move', () => {
    const forward = pressInPresentation(at(2), RemoteKey.Right)
    const backward = pressInPresentation(at(2), RemoteKey.Left)

    expect(placeOf(forward, slideAt(SLIDES, 2))).toBe(SlidePlace.Before)
    expect(placeOf(backward, slideAt(SLIDES, 2))).toBe(SlidePlace.After)
  })

  it('should place the last slide of a round before the first of the next', () => {
    const sut = advancePresentation(at(4), LOOPING)

    expect(placeOf(sut, slideAt(SLIDES, 4))).toBe(SlidePlace.Before)
    expect(placeOf(sut, slideAt(NEXT_ROUND, 1))).toBe(SlidePlace.After)
  })
})
