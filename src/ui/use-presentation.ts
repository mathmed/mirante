import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'

import { slideMs } from '../core/presentation-effects.ts'
import type { PresentationSettings } from '../core/presentation-settings.ts'
import {
  advancePresentation,
  extendPresentation,
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
  // More slides of the first round are on their way: they come as new slides of the viewer, which
  // waits on its last slide meanwhile.
  readonly isGrowing: boolean
  // A slide shows, by its place in the round: a source read a little at a time may read ahead.
  readonly onShow: (index: number) => void
}

// The viewer opened from a grid plays the same photos again, in the same order.
export const SAME_SLIDES: Rounds = {
  after: ({ slides }) => slides,
  onStart: () => undefined,
  isGrowing: false,
  onShow: () => undefined,
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
  const { slides, rounds, settings } = options
  const [started, setStarted] = useState(() =>
    startPresentation(slides, options.start, options.shouldPlay),
  )
  // The slides that came since it started, for a source read a little at a time.
  const state = useMemo(() => extendPresentation(started, slides), [started, slides])
  const change = useCallback(
    (next: (current: PresentationState) => PresentationState) => {
      setStarted((previous) => next(extendPresentation(previous, slides)))
    },
    [slides],
  )
  const upcoming = useUpcoming(state, rounds, settings)
  useEffect(() => {
    rounds.onShow(state.index)
  }, [rounds, state.index])
  useClock({ ...options, state, upcoming, change })
  const press = useCallback(
    (key: RemoteKey) => {
      change((current) => pressInPresentation(current, key))
    },
    [change],
  )
  return { state, upcoming, press }
}

interface ClockOptions extends PresentationOptions {
  readonly state: PresentationState
  readonly upcoming: Upcoming
  readonly change: (next: (current: PresentationState) => PresentationState) => void
}

function useClock({ state, upcoming, isHeld, settings, change }: ClockOptions): void {
  useEffect(() => {
    if (!state.isPlaying || isHeld) {
      return undefined
    }
    const timer = setTimeout(() => {
      change((current) => advancePresentation(current, upcoming))
    }, slideMs(settings))
    return () => {
      clearTimeout(timer)
    }
  }, [state, upcoming, isHeld, settings, change])
}

// What comes after the last slide; each round, once it starts, lets the next one load.
function useUpcoming(
  state: PresentationState,
  rounds: Rounds,
  settings: PresentationSettings,
): Upcoming {
  const { round, slides } = state
  const upcoming = useMemo(
    () => ({
      shouldLoop: settings.shouldLoop,
      nextRound: rounds.after({ round, slides }),
      isRoundGrowing: rounds.isGrowing,
    }),
    [settings.shouldLoop, rounds, round, slides],
  )
  useEffect(() => {
    rounds.onStart(round)
  }, [rounds, round])
  return upcoming
}
