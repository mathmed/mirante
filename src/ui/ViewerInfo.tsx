import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'

import type { Photo } from '../core/photo-library.ts'
import { interfaceMs } from '../core/presentation-effects.ts'
import type { PresentationSettings } from '../core/presentation-settings.ts'
import type { PresentationState } from '../core/presentation.ts'
import { counterText, MESSAGES, photoDateText } from './messages.ts'

export interface ViewerInfoProps {
  readonly state: PresentationState
  readonly photo: Photo | undefined
  readonly settings: PresentationSettings
  // While the settings cover the viewer, the slideshow waits and shows no progress.
  readonly isHeld: boolean
}

// The date, the keys and the counter at the top, and, during the slideshow, how long until the
// next photo: discreet, and gone by themselves a while after each change.
export function ViewerInfo({ state, photo, settings, isHeld }: ViewerInfoProps): JSX.Element {
  const isVisible = useVisibleAfterChange(state, interfaceMs(settings))
  return (
    <div class={isVisible ? 'viewer-info is-visible' : 'viewer-info'} aria-hidden={!isVisible}>
      <div class="viewer-heading">
        {settings.shouldShowDate && <span class="viewer-date">{dateOf(photo)}</span>}
        <span class="viewer-hint">
          {state.isPlaying ? MESSAGES.slideshowPlaying : MESSAGES.slideshowPaused}
        </span>
      </div>
      {settings.shouldShowCounter && (
        <span class="viewer-counter">{counterText(state.index, state.slides.length)}</span>
      )}
      <Progress state={state} settings={settings} isHeld={isHeld} />
    </div>
  )
}

function dateOf(photo: Photo | undefined): string {
  return photo === undefined ? '' : photoDateText(photo.date)
}

interface ProgressProps {
  readonly state: PresentationState
  readonly settings: PresentationSettings
  readonly isHeld: boolean
}

// A thin line that fills up in the interval of the slideshow, by a transform alone; each photo
// draws a new one.
function Progress({ state, settings, isHeld }: ProgressProps): JSX.Element | null {
  if (!state.isPlaying || isHeld) {
    return null
  }
  return (
    <span key={`${String(state.round)}-${String(state.index)}`} class="viewer-progress">
      <span
        class="viewer-progress-bar"
        style={{ animationDuration: `${String(settings.intervalSeconds)}s` }}
      />
    </span>
  )
}

function useVisibleAfterChange(state: PresentationState, visibleMs: number): boolean {
  const [hiddenState, setHiddenState] = useState<PresentationState | undefined>(undefined)
  useEffect(() => {
    const timer = setTimeout(() => {
      setHiddenState(state)
    }, visibleMs)
    return () => {
      clearTimeout(timer)
    }
  }, [state, visibleMs])
  return hiddenState !== state
}
