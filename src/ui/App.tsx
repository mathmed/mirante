import type { JSX } from 'preact'

import type { KeySource } from '../core/remote-key.ts'
import type { TextStorage } from '../core/settings-storage.ts'
import { LOADING, type StartupOutcome, type StartupState, StartupStatus } from '../core/startup.ts'
import { Gallery } from './Gallery.tsx'
import { Logo, LogoLayout } from './Logo.tsx'
import { MESSAGES } from './messages.ts'
import { Failure, Waiting } from './Status.tsx'
import { useLoad } from './use-load.ts'

export interface AppProps {
  readonly start: () => Promise<StartupOutcome>
  readonly keys: KeySource
  readonly reportError: (error: unknown) => void
  // Back on the first screen leaves the app (on a TV; a browser stays on the page).
  readonly leave: () => void
  // Where the TV keeps its settings of the presentations.
  readonly storage: TextStorage
  // Where the TV keeps the seed of each book it reorganized.
  readonly bookStorage: TextStorage
  // A new seed for each random order.
  readonly newSeed: () => number
}

// The opening: the logo fades in while the app connects, and gives way to the gallery as soon as
// the server answers, never later.
export function App(props: AppProps): JSX.Element {
  const { start, keys, leave } = props
  const { state, retry } = useLoad<StartupState>(start, LOADING)
  if (state.status === StartupStatus.Connected) {
    return <Gallery {...props} session={state.session} />
  }
  return (
    <main class="screen screen-centered splash">
      <h1 class="splash-logo">
        <Logo layout={LogoLayout.Stacked} />
      </h1>
      {state.status === StartupStatus.Loading ? (
        <Waiting text={MESSAGES.connecting} keys={keys} onBack={leave} />
      ) : (
        <Failure failure={state.failure} keys={keys} onRetry={retry} onBack={leave} />
      )}
    </main>
  )
}
