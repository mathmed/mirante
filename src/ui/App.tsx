import type { JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'

import type { ServerInfo } from '../core/photo-library.ts'
import { type StartupFailure, type StartupOutcome, StartupStatus } from '../core/startup.ts'
import { failureText, MESSAGES } from './messages.ts'
import { useStartup } from './use-startup.ts'

export interface AppProps {
  readonly start: () => Promise<StartupOutcome>
}

export function App({ start }: AppProps): JSX.Element {
  const { state, retry } = useStartup(start)
  return (
    <main class="screen">
      <h1 class="brand">{MESSAGES.appName}</h1>
      {state.status === StartupStatus.Loading && <Connecting />}
      {state.status === StartupStatus.Connected && <Connected server={state.server} />}
      {state.status === StartupStatus.Failed && <Failed failure={state.failure} onRetry={retry} />}
    </main>
  )
}

function Connecting(): JSX.Element {
  return (
    <p class="status" role="status">
      {MESSAGES.connecting}
    </p>
  )
}

function Connected({ server }: { readonly server: ServerInfo }): JSX.Element {
  return (
    <section class="panel" aria-labelledby="connected-title">
      <h2 id="connected-title">{MESSAGES.connected}</h2>
      <dl class="facts">
        <dt>{MESSAGES.server}</dt>
        <dd>{server.address}</dd>
        <dt>{MESSAGES.immichVersion}</dt>
        <dd>{server.version}</dd>
      </dl>
    </section>
  )
}

interface FailedProps {
  readonly failure: StartupFailure
  readonly onRetry: () => void
}

// The retry button takes the focus: the remote control's Enter is the only way to press it.
function Failed({ failure, onRetry }: FailedProps): JSX.Element {
  const buttonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    buttonRef.current?.focus()
  }, [])
  const text = failureText(failure)
  return (
    <section class="panel panel-error" role="alert">
      <h2>{text.title}</h2>
      <p>{text.hint}</p>
      <button ref={buttonRef} class="action" type="button" onClick={onRetry}>
        {MESSAGES.retry}
      </button>
    </section>
  )
}
