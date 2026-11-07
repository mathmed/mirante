import { fireEvent, screen, waitFor } from '@testing-library/preact'
import { render } from 'preact'
import { expect, vi } from 'vitest'

import { fakeServer } from './fake-immich.ts'

// The whole app as the TV runs it (src/main.tsx), against the fake Immich server, driven by the key
// codes the TVs send.
export const KEY = {
  enter: 13,
  left: 37,
  up: 38,
  right: 39,
  down: 40,
  tizenBack: 10_009,
  webOsBack: 461,
  info: 457,
  escape: 27,
  backspace: 8,
} as const

export function press(...codes: readonly number[]): void {
  for (const keyCode of codes) {
    fireEvent.keyDown(document.activeElement ?? document.body, { keyCode })
  }
}

export async function focusedOn(text: string): Promise<void> {
  await waitFor(() => {
    expect(document.activeElement?.textContent).toContain(text)
  })
}

// The start screen opens on its first card, every photo; the albums are the next one.
export async function onAlbumsCard(): Promise<void> {
  await focusedOn('Todas')
  press(KEY.right)
  await focusedOn('Álbuns')
}

export async function title(text: string): Promise<void> {
  await screen.findByRole('heading', { level: 1, name: text })
}

// The photos on the screen: the grid's thumbnails or the viewer's previews, not the mark of the app.
export function sources(): (string | null)[] {
  return [...document.querySelectorAll('img.picture')].map((image) => image.getAttribute('src'))
}

// The day on the clock of the TV: no photo of the sample library is near it in a past year.
const APP_DAY = new Date(2026, 10, 7, 12)

// Runs src/main.tsx again, in a page of its own, on that day (or another); vi.resetModules() must
// come before it. Only the date is faked: the timers run as they do on a TV.
export async function startApp(day = APP_DAY): Promise<void> {
  vi.useFakeTimers({ toFake: ['Date'], now: day, shouldAdvanceTime: true })
  document.body.innerHTML = '<div id="app"></div>'
  await import('../src/main.tsx')
}

// Takes the app off the page, forgets what the TV kept and the requests listened to.
export function stopApp(): void {
  vi.useRealTimers()
  fakeServer.events.removeAllListeners()
  const root = document.getElementById('app')
  if (root !== null) {
    render(null, root)
  }
  document.body.innerHTML = ''
  window.localStorage.clear()
}
