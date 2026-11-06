import type { JSX } from 'preact'

import type { PresentationSettings } from '../core/presentation-settings.ts'
import type { PresentationState } from '../core/presentation.ts'
import type { CaptionPlace } from './Caption.tsx'

export interface ProgressProps {
  // The viewer or the book: the same places as the captions'.
  readonly place: CaptionPlace
  readonly state: PresentationState
  readonly settings: PresentationSettings
  // While something covers the presentation, it waits and shows no progress.
  readonly isHeld: boolean
}

// While a presentation plays, a thin amber line that fills up in its interval, by a transform alone;
// each slide draws a new one.
export function Progress({ place, state, settings, isHeld }: ProgressProps): JSX.Element | null {
  if (!state.isPlaying || isHeld) {
    return null
  }
  return (
    <span key={`${String(state.round)}-${String(state.index)}`} class={`${place}-progress`}>
      <span
        class={`${place}-progress-bar`}
        style={{ animationDuration: `${String(settings.intervalSeconds)}s` }}
      />
    </span>
  )
}
