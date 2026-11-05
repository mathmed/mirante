import { RemoteKey } from './remote-key.ts'

// The full-screen viewer: which photo it shows, and whether the slideshow moves on by itself.
export interface ViewerState {
  readonly index: number
  readonly isPlaying: boolean
}

export function openViewer(index: number, count: number): ViewerState {
  return { index: Math.max(0, Math.min(index, count - 1)), isPlaying: false }
}

// Left and right stop at the first and the last photo; Enter starts or pauses the slideshow.
export function pressInViewer(state: ViewerState, key: RemoteKey, count: number): ViewerState {
  switch (key) {
    case RemoteKey.Left:
      return { ...state, index: Math.max(0, state.index - 1) }
    case RemoteKey.Right:
      return { ...state, index: state.index + 1 < count ? state.index + 1 : state.index }
    case RemoteKey.Enter:
      return { ...state, isPlaying: !state.isPlaying }
    default:
      return state
  }
}

// A tick of the slideshow: the next photo, back to the first after the last one.
export function advanceSlideshow(state: ViewerState, count: number): ViewerState {
  return { ...state, index: following(state.index, count) }
}

// The photos the viewer keeps decoded, at most three: the one on the screen, the next one, loaded
// ahead so that it shows at once (the first one again when the slideshow loops), and the previous
// one, for the way back.
export function decodedPhotos<T>(photos: readonly T[], state: ViewerState): readonly T[] {
  const next = state.isPlaying ? following(state.index, photos.length) : state.index + 1
  const indexes = [state.index, next, state.index - 1].filter(
    (index, position, all) => all.indexOf(index) === position,
  )
  // slice gives nothing for an index before the first photo or after the last one.
  return ([] as T[]).concat(...indexes.map((index) => photos.slice(index, index + 1)))
}

function following(index: number, count: number): number {
  return index + 1 < count ? index + 1 : 0
}
