import { act, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { current, preview, showViewer } from '../../test/viewer.ts'
import { DEFAULT_PRESENTATION } from '../core/presentation-settings.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { MESSAGES } from './messages.ts'

// The settings over the viewer: Info, or Down, opens them; Back keeps them and returns to the photo.
const { Right, Down, Back, Info, Enter } = RemoteKey
const SLIDESHOW_MS = 8000

function wait(ms: number): void {
  void act(() => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the settings of the viewer', () => {
  it.each([Info, Down])('should open over the photo on %s, the first row focused', (key) => {
    const sut = showViewer()

    sut.remote.press(key)

    expect(screen.getByRole('heading', { level: 2, name: MESSAGES.settings })).toBeTruthy()
    expect(document.activeElement?.textContent).toBe('Tempo de cada foto8 s')
    expect(current()).toBe(preview('p-3'))
  })

  it('should take the keys while open: the arrows change the settings, not the photo', () => {
    const sut = showViewer()

    sut.remote.press(Info, Right, Enter)

    expect(current()).toBe(preview('p-3'))
    expect(document.activeElement?.textContent).toBe('Tempo de cada foto9 s')
    expect(sut.closed).toStrictEqual([])
  })

  it('should keep the settings on Back and give the focus back to the viewer', () => {
    const sut = showViewer()

    sut.remote.press(Info, Right, Back)

    expect(sut.saved).toStrictEqual([{ ...DEFAULT_PRESENTATION, intervalSeconds: 9 }])
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
    expect(document.activeElement?.getAttribute('role')).toBe('dialog')
    expect(sut.closed).toStrictEqual([])
  })

  it('should hold the slideshow while open, and start its interval over after', () => {
    const sut = showViewer({ start: 0, shouldPlay: true })

    sut.remote.press(Info)
    wait(SLIDESHOW_MS * 2)
    expect(current()).toBe(preview('p-1'))
    expect(document.querySelector('.viewer-progress')).toBeNull()
    expect(document.querySelector('.viewer')?.className).toBe('viewer is-covered')
    sut.remote.press(Back)
    wait(SLIDESHOW_MS)

    expect(current()).toBe(preview('p-2'))
  })

  it('should close the viewer on Back once the settings are closed', () => {
    const sut = showViewer()

    sut.remote.press(Down, Back, Back)

    expect(sut.closed).toStrictEqual([2])
  })
})
