import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { StartupFailure, type StartupOutcome, StartupStatus } from '../core/startup.ts'
import { App } from './App.tsx'
import { failureText, MESSAGES } from './messages.ts'

const SERVER = { address: '192.168.0.10:2283', version: '3.3.6' }
const CONNECTED: StartupOutcome = { status: StartupStatus.Connected, server: SERVER }

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

describe('App', () => {
  it('should say it is connecting while the startup runs', () => {
    render(<App start={pendingStartup().start} />)

    expect(screen.getByRole('status').textContent).toBe(MESSAGES.connecting)
  })

  it('should show the server it connected to', async () => {
    render(<App start={startingWith(CONNECTED)} />)

    expect(await screen.findByText(SERVER.address)).toBeTruthy()
    expect(screen.getByText(SERVER.version)).toBeTruthy()
    expect(screen.getByRole('heading', { name: MESSAGES.connected })).toBeTruthy()
  })

  it('should explain a failure and focus the retry button', async () => {
    const text = failureText(StartupFailure.Missing)

    render(<App start={startingWith(failedWith(StartupFailure.Missing))} />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(text.title)
    expect(alert.textContent).toContain(text.hint)
    const retry = screen.getByRole('button', { name: MESSAGES.retry })
    await waitFor(() => {
      expect(document.activeElement).toBe(retry)
    })
  })

  it('should start again when the retry button is pressed', async () => {
    const startup = pendingStartup()
    render(<App start={startup.start} />)
    startup.settle(failedWith(StartupFailure.Unreachable))

    fireEvent.click(await screen.findByRole('button', { name: MESSAGES.retry }))

    expect(screen.getByRole('status').textContent).toBe(MESSAGES.connecting)
    expect(startup.calls()).toBe(1)
    startup.settle(CONNECTED)
    expect(await screen.findByText(SERVER.address)).toBeTruthy()
  })

  it('should ignore the outcome of a startup that was replaced', async () => {
    const first = pendingStartup()
    const { rerender } = render(<App start={first.start} />)
    rerender(<App start={startingWith(CONNECTED)} />)
    expect(await screen.findByText(SERVER.address)).toBeTruthy()

    first.settle(failedWith(StartupFailure.Unexpected))
    await Promise.resolve()

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(SERVER.address)).toBeTruthy()
  })
})
