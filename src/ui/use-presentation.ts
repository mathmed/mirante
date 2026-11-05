import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'

import { slideMs } from '../core/presentation-effects.ts'
import type { PresentationSettings } from '../core/presentation-settings.ts'
import {
  advancePresentation,
  type PresentationState,
  pressInPresentation,
  type Slide,
  startPresentation,
  type Upcoming,
} from '../core/presentation.ts'
import type { RemoteKey } from '../core/remote-key.ts'

// A round of the presentation: its number, from 0, and its slides.
export interface Round {
  readonly round: number
  readonly slides: readonly Slide[]
}

// Where the slides of the next rounds come from.
export interface Rounds {
  // The slides of the round after this one; undefined while they load.
  readonly after: (current: Round) => readonly Slide[] | undefined
  // A round starts: the next one may load meanwhile. Called again for the same round at times.
  readonly onStart: (round: number) => void
}

// The viewer opened from a grid plays the same photos again, in the same order.
export const SAME_SLIDES: Rounds = {
  after: ({ slides }) => slides,
  onStart: () => undefined,
}

export interface PresentationOptions {
  readonly slides: readonly Slide[]
  readonly start: number
  readonly shouldPlay: boolean
  readonly rounds: Rounds
  readonly settings: PresentationSettings
  // While something covers the viewer (its settings), the presentation waits.
  readonly isHeld: boolean
}

export interface PresentationControl {
  readonly state: PresentationState
  readonly upcoming: Upcoming
  readonly press: (key: RemoteKey) => void
}

// The state of the presentation and its clock: while it plays, the next slide comes after the
// interval; any change starts the interval over.
export function usePresentation(options: PresentationOptions): PresentationControl {
  const { rounds, settings, isHeld } = options
  const [state, setState] = useState(() =>
    startPresentation(options.slides, options.start, options.shouldPlay),
  )
  const { round, slides } = state
  const upcoming = useMemo(
    () => ({ shouldLoop: settings.shouldLoop, nextRound: rounds.after({ round, slides }) }),
    [settings.shouldLoop, rounds, round, slides],
  )
  useEffect(() => {
    rounds.onStart(round)
  }, [rounds, round])
  useEffect(() => {
    if (!state.isPlaying || isHeld) {
      return undefined
    }
    const timer = setTimeout(() => {
      setState((previous) => advancePresentation(previous, upcoming))
    }, slideMs(settings))
    return () => {
      clearTimeout(timer)
    }
  }, [state, upcoming, isHeld, settings])
  const press = useCallback((key: RemoteKey) => {
    setState((previous) => pressInPresentation(previous, key))
  }, [])
  return { state, upcoming, press }
}
