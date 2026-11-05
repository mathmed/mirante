import type { JSX } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import { ImageSize, type Photo, type PhotoLibrary } from '../core/photo-library.ts'
import { type KeySource, RemoteKey } from '../core/remote-key.ts'
import {
  advanceSlideshow,
  decodedPhotos,
  openViewer,
  pressInViewer,
  type ViewerState,
} from '../core/slideshow.ts'
import { counterText, MESSAGES, photoDateText } from './messages.ts'
import { Picture } from './Picture.tsx'
import { useRemoteKeys } from './use-remote-keys.ts'

// How long the date and the counter stay on the screen after the photo changes.
export const INFO_VISIBLE_MS = 4000
const MS_PER_SECOND = 1000

export interface ViewerProps {
  readonly photos: readonly Photo[]
  // The photo chosen in the grid.
  readonly start: number
  readonly library: PhotoLibrary
  readonly keys: KeySource
  readonly slideshowSeconds: number
  // Back: the grid takes the focus to the photo on the screen.
  readonly onClose: (index: number) => void
}

// One photo at a time, full screen, in its preview size: never the original.
export function Viewer(props: ViewerProps): JSX.Element {
  const { photos, library } = props
  const count = photos.length
  const [state, setState] = useSlideshow(props.start, count, props.slideshowSeconds)
  useViewerKeys(props, state, setState)
  const viewerRef = useFocusOnMount()
  const current = photos[state.index]
  return (
    <div
      ref={viewerRef}
      class="viewer"
      role="dialog"
      aria-label={counterText(state.index, count)}
      tabIndex={-1}
    >
      {decodedPhotos(photos, state).map((photo) => (
        <div key={photo.id} class={photo === current ? 'slide is-current' : 'slide'}>
          <Picture
            url={library.imageUrl(photo.id, ImageSize.Preview)}
            alt={photoDateText(photo.date)}
            missingText={MESSAGES.previewUnavailable}
          />
        </div>
      ))}
      <div class="viewer-vignette" />
      <Info state={state} count={count} photo={current} seconds={props.slideshowSeconds} />
    </div>
  )
}

type SetViewerState = (update: (previous: ViewerState) => ViewerState) => void

// Left and right move, Enter starts or pauses the slideshow, Back closes the viewer.
function useViewerKeys(props: ViewerProps, state: ViewerState, setState: SetViewerState): void {
  const { onClose } = props
  const count = props.photos.length
  const onKey = useCallback(
    (key: RemoteKey) => {
      if (key === RemoteKey.Back) {
        onClose(state.index)
      } else {
        setState((previous) => pressInViewer(previous, key, count))
      }
    },
    [state.index, count, onClose, setState],
  )
  useRemoteKeys(props.keys, onKey)
}

interface InfoProps {
  readonly state: ViewerState
  readonly count: number
  readonly photo: Photo | undefined
  readonly seconds: number
}

// The date, the counter, the keys and, during the slideshow, how long until the next photo:
// discreet, and gone by themselves a few seconds after each change.
function Info({ state, count, photo, seconds }: InfoProps): JSX.Element {
  const isVisible = useVisibleAfterChange(state)
  return (
    <div class={isVisible ? 'viewer-info is-visible' : 'viewer-info'} aria-hidden={!isVisible}>
      <div class="viewer-caption">
        <span class="viewer-date">{photo === undefined ? '' : photoDateText(photo.date)}</span>
        <span class="viewer-hint">
          {state.isPlaying ? MESSAGES.slideshowPlaying : MESSAGES.slideshowPaused}
        </span>
      </div>
      <span class="viewer-counter">{counterText(state.index, count)}</span>
      {state.isPlaying && <Progress key={state.index} seconds={seconds} />}
    </div>
  )
}

interface ProgressProps {
  readonly seconds: number
}

// A thin line that fills up in the interval of the slideshow, by a transform alone; each photo
// draws a new one.
function Progress({ seconds }: ProgressProps): JSX.Element {
  return (
    <span class="viewer-progress">
      <span class="viewer-progress-bar" style={{ animationDuration: `${String(seconds)}s` }} />
    </span>
  )
}

// While the slideshow plays, the next photo comes after the interval; any change restarts it.
function useSlideshow(
  start: number,
  count: number,
  seconds: number,
): [ViewerState, SetViewerState] {
  const [state, setState] = useState(() => openViewer(start, count))
  useEffect(() => {
    if (!state.isPlaying) {
      return undefined
    }
    const timer = setTimeout(() => {
      setState((previous) => advanceSlideshow(previous, count))
    }, seconds * MS_PER_SECOND)
    return () => {
      clearTimeout(timer)
    }
  }, [state, count, seconds])
  return [state, setState]
}

function useVisibleAfterChange(state: ViewerState): boolean {
  const [hiddenState, setHiddenState] = useState<ViewerState | undefined>(undefined)
  useEffect(() => {
    const timer = setTimeout(() => {
      setHiddenState(state)
    }, INFO_VISIBLE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [state])
  return hiddenState !== state
}

// The grid that held the focus is gone: the viewer takes it.
function useFocusOnMount(): { readonly current: HTMLDivElement | null } {
  const viewerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    viewerRef.current?.focus({ preventScroll: true })
  }, [])
  return viewerRef
}
