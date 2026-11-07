import { sortPhotos } from './gallery.ts'
import { type Photo, PhotoOrder } from './photo-library.ts'
import { PlaybackOrder } from './presentation-settings.ts'
import { RemoteKey } from './remote-key.ts'
import { roundSeed, shuffled } from './shuffle.ts'

// What the screen shows at once. Today a slide holds a single photo; the list is there for a later
// version that lays several photos of an album on one page.
export interface Slide {
  readonly key: string
  readonly photos: readonly [Photo, ...Photo[]]
}

export const Direction = {
  Forward: 'forward',
  Backward: 'backward',
} as const

export type Direction = (typeof Direction)[keyof typeof Direction]

// A presentation runs in rounds: the slides of one round, then those of the next when it loops.
export interface PresentationState {
  readonly slides: readonly Slide[]
  readonly index: number
  readonly round: number
  readonly isPlaying: boolean
  // Where the last move went: the transitions slide that way.
  readonly direction: Direction
  // The slide on the screen before this one, which a transition takes away.
  readonly leaving: Slide | undefined
}

// Where a slide kept decoded stands: on the screen, or out of it, on one side or the other.
export const SlidePlace = {
  Current: 'current',
  Before: 'before',
  After: 'after',
} as const

export type SlidePlace = (typeof SlidePlace)[keyof typeof SlidePlace]

// What comes after the last slide of the round.
export interface Upcoming {
  readonly shouldLoop: boolean
  // The slides of the next round; undefined while they load.
  readonly nextRound: readonly Slide[] | undefined
  // More slides of this round are on their way (a source read a little at a time): the last slide
  // waits for them, in a loop or not.
  readonly isRoundGrowing: boolean
}

// The slides loaded ahead: the next one, decoded, and the one after it, only downloaded.
const AHEAD = 2
// The viewer never keeps more images decoded than this.
const MAX_DECODED = 3

export function slideOf(photo: Photo): Slide {
  return { key: photo.id, photos: [photo] }
}

// The photos of a source in the order of the presentation, each once. A random order shuffles the
// photos in the order they were taken, so that the seed alone decides it.
export function playlistOf(
  photos: readonly Photo[],
  order: PlaybackOrder,
  seed: number,
): readonly Slide[] {
  return orderedPhotos(withoutRepeats(photos), order, seed).map(slideOf)
}

// The next round of the same photos: a new random order (or the same order by date), never
// starting on the photo the last round ended on.
export function nextRoundOf(
  photos: readonly Photo[],
  order: PlaybackOrder,
  round: { readonly seed: number; readonly number: number; readonly last: Slide | undefined },
): readonly Slide[] {
  const slides = playlistOf(photos, order, roundSeed(round.seed, round.number))
  const [first, ...rest] = slides
  return first !== undefined && first.key === round.last?.key ? [...rest, first] : slides
}

export function startPresentation(
  slides: readonly Slide[],
  start: number,
  isPlaying: boolean,
): PresentationState {
  const index = Math.max(0, Math.min(start, slides.length - 1))
  return { slides, index, round: 0, isPlaying, direction: Direction.Forward, leaving: undefined }
}

// More slides of the round came: the same slides, then more. Anything else changes nothing.
export function extendPresentation(
  state: PresentationState,
  slides: readonly Slide[],
): PresentationState {
  const isLonger = slides.length > state.slides.length
  if (!isLonger || slides[state.index]?.key !== currentSlide(state)?.key) {
    return state
  }
  return { ...state, slides }
}

// Photos deleted, or taken out of their album, while the viewer shows them leave it: the slide
// after the one on the screen takes its place when that one leaves, the last one when it was last.
export function withoutSlides(
  state: PresentationState,
  gone: ReadonlySet<string>,
): PresentationState {
  const isKept = (slide: Slide): boolean => !gone.has(slide.key)
  const slides = state.slides.filter(isKept)
  if (slides.length === state.slides.length) {
    return state
  }
  const before = state.slides.slice(0, state.index).filter(isKept).length
  const index = Math.max(0, Math.min(before, slides.length - 1))
  return { ...state, slides, index, leaving: undefined }
}

export function currentSlide(state: PresentationState): Slide | undefined {
  return state.slides[state.index]
}

// Left and right stop at the first and the last slide; Enter starts or pauses the presentation.
// A key that changes nothing gives back the same state.
export function pressInPresentation(state: PresentationState, key: RemoteKey): PresentationState {
  switch (key) {
    case RemoteKey.Left:
      return moveTo(state, state.index - 1, Direction.Backward)
    case RemoteKey.Right:
      return moveTo(state, state.index + 1, Direction.Forward)
    case RemoteKey.Enter:
      return { ...state, isPlaying: !state.isPlaying }
    default:
      return state
  }
}

// A tick of the presentation: the next slide; after the last one, the next round when it loops
// (once it is there), or a pause on the last slide when it does not.
export function advancePresentation(
  state: PresentationState,
  upcoming: Upcoming,
): PresentationState {
  if (state.index + 1 < state.slides.length) {
    return moveTo(state, state.index + 1, Direction.Forward)
  }
  if (upcoming.isRoundGrowing) {
    return state
  }
  if (!upcoming.shouldLoop) {
    return { ...state, isPlaying: false }
  }
  return startRound(state, upcoming.nextRound ?? [])
}

// The next two slides, into the next round while the presentation plays in a loop. Paused, the
// arrows stop at the last slide: nothing comes after it.
export function slidesAhead(state: PresentationState, upcoming: Upcoming): readonly Slide[] {
  const ahead = state.slides.slice(state.index + 1, state.index + 1 + AHEAD)
  const isLooping = state.isPlaying && upcoming.shouldLoop && !upcoming.isRoundGrowing
  const nextRound = isLooping ? (upcoming.nextRound ?? []) : []
  return ahead.concat(nextRound.slice(0, AHEAD - ahead.length))
}

// The slides kept decoded, at most three: the one on the screen, the one leaving it, the next one
// and the previous one, for the way back, in that priority.
export function decodedSlides(state: PresentationState, ahead: readonly Slide[]): readonly Slide[] {
  const candidates = [currentSlide(state), state.leaving, ahead[0], state.slides[state.index - 1]]
  const present = candidates.filter((slide): slide is Slide => slide !== undefined)
  return present
    .filter((slide, position) => present.findIndex(({ key }) => key === slide.key) === position)
    .slice(0, MAX_DECODED)
}

// The slide leaving the screen goes the way of the move: back where it came from when the move goes
// backward. The previous slide waits before the screen, every other one after it.
export function placeOf(state: PresentationState, slide: Slide): SlidePlace {
  if (isSame(currentSlide(state), slide)) {
    return SlidePlace.Current
  }
  if (isSame(state.leaving, slide)) {
    return state.direction === Direction.Forward ? SlidePlace.Before : SlidePlace.After
  }
  return isSame(state.slides[state.index - 1], slide) ? SlidePlace.Before : SlidePlace.After
}

function isSame(candidate: Slide | undefined, slide: Slide): boolean {
  return candidate?.key === slide.key
}

function startRound(state: PresentationState, slides: readonly Slide[]): PresentationState {
  if (slides.length === 0) {
    return state
  }
  return {
    ...state,
    slides,
    index: 0,
    round: state.round + 1,
    direction: Direction.Forward,
    leaving: currentSlide(state),
  }
}

function moveTo(state: PresentationState, index: number, direction: Direction): PresentationState {
  if (index < 0 || index >= state.slides.length) {
    return state
  }
  return { ...state, index, direction, leaving: currentSlide(state) }
}

function orderedPhotos(
  photos: readonly Photo[],
  order: PlaybackOrder,
  seed: number,
): readonly Photo[] {
  switch (order) {
    case PlaybackOrder.NewestFirst:
      return sortPhotos(photos, PhotoOrder.NewestFirst)
    case PlaybackOrder.Random:
      return shuffled(sortPhotos(photos, PhotoOrder.OldestFirst), seed)
    default:
      return sortPhotos(photos, PhotoOrder.OldestFirst)
  }
}

function withoutRepeats(photos: readonly Photo[]): readonly Photo[] {
  const ids = new Set<string>()
  return photos.filter((photo) => {
    const isNew = !ids.has(photo.id)
    ids.add(photo.id)
    return isNew
  })
}
