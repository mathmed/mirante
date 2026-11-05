import { render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { fakeRemote } from '../../test/remote.ts'
import { LoadFailure } from '../core/loading.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { failureText, MESSAGES } from './messages.ts'
import { Empty, Failure, Waiting } from './Status.tsx'

function counter(): { readonly count: () => number; readonly add: () => void } {
  let count = 0
  return {
    count: () => count,
    add: () => {
      count += 1
    },
  }
}

describe('Waiting', () => {
  it('should say what it waits for and go back on Back only', () => {
    const remote = fakeRemote()
    const backs = counter()
    render(<Waiting text={MESSAGES.loading} keys={remote.keys} onBack={backs.add} />)

    remote.press(RemoteKey.Enter, RemoteKey.Down, RemoteKey.Back)

    expect(screen.getByRole('status').textContent).toBe(MESSAGES.loading)
    expect(document.querySelector('.status .status-mark')).not.toBeNull()
    expect(backs.count()).toBe(1)
  })

  it('should ignore Back where there is nowhere to go back to', () => {
    const remote = fakeRemote()
    render(<Waiting text={MESSAGES.connecting} keys={remote.keys} />)

    remote.press(RemoteKey.Back)

    expect(screen.getByRole('status').textContent).toBe(MESSAGES.connecting)
  })
})

describe('Failure', () => {
  it('should explain the failure and focus the retry button', async () => {
    const remote = fakeRemote()
    render(
      <Failure failure={LoadFailure.Unreachable} keys={remote.keys} onRetry={() => undefined} />,
    )

    const alert = screen.getByRole('alert')
    expect(alert.querySelector('.panel-mark')).not.toBeNull()
    expect(alert.textContent).toContain(failureText(LoadFailure.Unreachable).title)
    expect(alert.textContent).toContain(failureText(LoadFailure.Unreachable).hint)
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: MESSAGES.retry }))
    })
  })

  it('should retry on Enter and go back on Back', () => {
    const remote = fakeRemote()
    const retries = counter()
    const backs = counter()
    render(
      <Failure
        failure={LoadFailure.ServerError}
        keys={remote.keys}
        onRetry={retries.add}
        onBack={backs.add}
      />,
    )

    remote.press(RemoteKey.Enter, RemoteKey.Left, RemoteKey.Back)

    expect(retries.count()).toBe(1)
    expect(backs.count()).toBe(1)
  })

  it('should stay on Back where there is nowhere to go back to', () => {
    const remote = fakeRemote()
    const retries = counter()
    render(<Failure failure={LoadFailure.ServerError} keys={remote.keys} onRetry={retries.add} />)

    remote.press(RemoteKey.Back)

    expect(retries.count()).toBe(0)
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})

describe('Empty', () => {
  it('should say there is nothing to show and go back on Enter or Back', async () => {
    const remote = fakeRemote()
    const backs = counter()
    render(<Empty text={MESSAGES.emptyAlbum} keys={remote.keys} onBack={backs.add} />)

    expect(screen.getByRole('status').textContent).toContain(MESSAGES.emptyAlbum.title)
    expect(screen.getByRole('status').textContent).toContain(MESSAGES.emptyAlbum.hint)
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: MESSAGES.back }))
    })
    remote.press(RemoteKey.Enter, RemoteKey.Back)
    expect(backs.count()).toBe(2)
  })
})
