import type { JSX } from 'preact'
import { useCallback, useMemo, useState } from 'preact/hooks'

import type { Photo } from '../core/photo-library.ts'
import {
  isDrawnEachRound,
  loadSourcePhotos,
  orderOf,
  type PresentationSource,
} from '../core/presentation-source.ts'
import { playlistOf } from '../core/presentation.ts'
import { Frame } from './Frame.tsx'
import { Loaded } from './Loaded.tsx'
import { MESSAGES, sourceTitle } from './messages.ts'
import type { ScreenProps } from './screen-props.ts'
import { useLibraryLoad } from './use-load.ts'
import type { Rounds } from './use-presentation.ts'
import { type Plan, useDrawnRounds, useReplayedRounds } from './use-rounds.ts'
import { Viewer } from './Viewer.tsx'

export interface PresentationScreenProps extends ScreenProps {
  readonly source: PresentationSource
}

// A presentation of an album, a month, a year or the whole library, with the settings of the TV:
// it plays as soon as the photos arrive; Back returns to where it was chosen.
export function PresentationScreen(props: PresentationScreenProps): JSX.Element {
  const { library, source, keys, reportError, back } = props
  const task = useCallback(async () => loadSourcePhotos(library, source), [library, source])
  const load = useLibraryLoad(task, reportError)
  return (
    <Frame title={sourceTitle(source)}>
      <Loaded
        load={load}
        emptyText={MESSAGES.emptyPresentation}
        keys={keys}
        onBack={back}
        render={(photos) =>
          isDrawnEachRound(source) ? (
            <DrawnPresentation {...props} photos={photos} />
          ) : (
            <ReplayedPresentation {...props} photos={photos} />
          )
        }
      />
    </Frame>
  )
}

interface PlayerProps extends PresentationScreenProps {
  readonly photos: readonly Photo[]
}

function ReplayedPresentation(props: PlayerProps): JSX.Element {
  const plan = usePlan(props)
  return <Player {...props} plan={plan} rounds={useReplayedRounds(props.photos, plan)} />
}

function DrawnPresentation(props: PlayerProps): JSX.Element {
  const plan = usePlan(props)
  return <Player {...props} plan={plan} rounds={useDrawnRounds({ ...props, plan })} />
}

interface PlanProps extends PlayerProps {
  readonly plan: Plan
  readonly rounds: Rounds
}

function Player(props: PlanProps): JSX.Element {
  const { photos, plan, back } = props
  const slides = useMemo(() => playlistOf(photos, plan.order, plan.seed), [photos, plan])
  return (
    <Viewer {...props} slides={slides} start={0} shouldPlay onClose={back} changes={undefined} />
  )
}

// The order and the seed, drawn once when the presentation starts.
function usePlan({ source, presentation }: PlayerProps): Plan {
  const [plan] = useState(() => ({
    order: orderOf(source, presentation.settings.order),
    seed: presentation.newSeed(),
  }))
  return plan
}
