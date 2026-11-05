import { useCallback, useMemo, useRef, useState } from 'preact/hooks'

import type { Photo, PhotoLibrary } from '../core/photo-library.ts'
import type { PlaybackOrder } from '../core/presentation-settings.ts'
import { drawRound } from '../core/presentation-source.ts'
import { nextRoundOf } from '../core/presentation.ts'
import type { Round, Rounds } from './use-presentation.ts'

// How a presentation orders its photos, decided when it starts: the settings may change while it
// plays, the order of its rounds does not.
export interface Plan {
  readonly order: PlaybackOrder
  readonly seed: number
}

// An album, a month or a year: the same photos in each round, in a new order when it is random.
export function useReplayedRounds(photos: readonly Photo[], plan: Plan): Rounds {
  return useMemo(
    () =>
      roundsOf(
        () => photos,
        plan,
        () => undefined,
      ),
    [photos, plan],
  )
}

export interface DrawnRoundsOptions {
  readonly library: PhotoLibrary
  // The photos of the first round, already drawn.
  readonly photos: readonly Photo[]
  readonly plan: Plan
  readonly reportError: (error: unknown) => void
}

// The whole library: a new draw from the server for each round, made while the round before it
// plays (when a draw fails, the photos of the first one play again). Only the round on the screen
// and the next one are kept.
export function useDrawnRounds({ library, photos, plan, reportError }: DrawnRoundsOptions): Rounds {
  const [drawn, setDrawn] = useState<ReadonlyMap<number, readonly Photo[]>>(
    () => new Map([[0, photos]]),
  )
  const askedRef = useRef(new Set<number>())
  const onStart = useCallback(
    (round: number) => {
      const next = round + 1
      if (askedRef.current.has(next)) {
        return
      }
      askedRef.current.add(next)
      void drawRound(library, photos, reportError).then((drawnPhotos) => {
        setDrawn((previous) => keptFrom(previous, round).set(next, drawnPhotos))
      })
    },
    [library, photos, reportError],
  )
  return useMemo(() => roundsOf((round) => drawn.get(round), plan, onStart), [drawn, plan, onStart])
}

function roundsOf(
  photosOf: (round: number) => readonly Photo[] | undefined,
  plan: Plan,
  onStart: (round: number) => void,
): Rounds {
  return {
    after: ({ round, slides }: Round) => {
      const photos = photosOf(round + 1)
      const last = slides[slides.length - 1]
      return photos === undefined
        ? undefined
        : nextRoundOf(photos, plan.order, { seed: plan.seed, number: round + 1, last })
    },
    onStart,
    isGrowing: false,
    onShow: () => undefined,
  }
}

function keptFrom(
  rounds: ReadonlyMap<number, readonly Photo[]>,
  round: number,
): Map<number, readonly Photo[]> {
  return new Map([...rounds].filter(([number]) => number >= round))
}
