import { render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { memoryLibrary } from '../../test/library-stub.ts'
import { fakeRemote, type FakeRemote } from '../../test/remote.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { StartupFailure, type StartupOutcome, StartupStatus } from '../core/startup.ts'
import { App } from './App.tsx'
import { failureText, MESSAGES } from './messages.ts'

const SERVER = { address: '192.168.0.10:2283', version: '3.3.6' }
const LIBRARY = memoryLibrary({
  server: SERVER,
  albums: [],
  albumPhotos: new Map(),
  months: [],
  monthPhotos: new Map(),
})
const CONNECTED: StartupOutcome = {
  status: StartupStatus.Connected,
  session: { server: SERVER, library: LIBRARY, slideshowSeconds: 8 },
}

function startingWith(outcome: StartupOutcome): () => Promise<StartupOutcome> {
  return async () => Promise.resolve(outcome)
}

function failedWith(failure: StartupFailure): StartupOutcome {
  return { status: StartupStatus.Failed, failure }
}

interface Pending {
  readonly start: () => Promise<StartupOutcome>
  readonly calls: () => number
  readonly settle: (outcome: StartupOutcome) => void
}

// A startup that settles only when the test says so, one call after the other.
function pendingStartup(): Pending {
  const waiting: ((outcome: StartupOutcome) => void)[] = []
  return {
    start: async () =>
      new Promise((resolve) => {
        waiting.push(resolve)
      }),
    calls: () => waiting.length,
    settle: (outcome) => {
      waiting.shift()?.(outcome)
    },
  }
}

function renderApp(start: () => Promise<StartupOutcome>): FakeRemote {
  const remote = fakeRemote()
  render(<App start={start} keys={remote.keys} reportError={() => undefined} />)
  return remote
}

describe('App', () => {
  it('should say it is connecting while the startup runs', () => {
    renderApp(pendingStartup().start)

    expect(screen.getByRole('status').textContent).toBe(MESSAGES.connecting)
  })

  it('should open the gallery on the server it connected to', async () => {
    renderApp(startingWith(CONNECTED))

    expect(await screen.findByText('Immich 3.3.6 em 192.168.0.10:2283')).toBeTruthy()
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe(MESSAGES.albums)
    })
  })

  it('should explain a failure and focus the retry button', async () => {
    const text = failureText(StartupFailure.Missing)

    renderApp(startingWith(failedWith(StartupFailure.Missing)))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(text.title)
    expect(alert.textContent).toContain(text.hint)
    const retry = screen.getByRole('button', { name: MESSAGES.retry })
    await waitFor(() => {
      expect(document.activeElement).toBe(retry)
    })
  })

  it('should start again when Enter presses the retry button', async () => {
    const startup = pendingStartup()
    const remote = renderApp(startup.start)
    startup.settle(failedWith(StartupFailure.Unreachable))
    await screen.findByRole('alert')

    remote.press(RemoteKey.Enter)

    expect(screen.getByRole('status').textContent).toBe(MESSAGES.connecting)
    expect(startup.calls()).toBe(1)
    startup.settle(CONNECTED)
    expect(await screen.findByText('Immich 3.3.6 em 192.168.0.10:2283')).toBeTruthy()
  })

  it('should stay on the failure on Back', async () => {
    const startup = pendingStartup()
    const remote = renderApp(startup.start)
    startup.settle(failedWith(StartupFailure.KeyMissing))
    await screen.findByRole('alert')

    remote.press(RemoteKey.Back)

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(startup.calls()).toBe(0)
  })

  it('should ignore the outcome of a startup that was replaced', async () => {
    const first = pendingStartup()
    const remote = fakeRemote()
    const { rerender } = render(
      <App start={first.start} keys={remote.keys} reportError={() => undefined} />,
    )
    rerender(
      <App start={startingWith(CONNECTED)} keys={remote.keys} reportError={() => undefined} />,
    )
    expect(await screen.findByText(MESSAGES.albums)).toBeTruthy()

    first.settle(failedWith(StartupFailure.Unexpected))
    await Promise.resolve()

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(MESSAGES.albums)).toBeTruthy()
  })
})
