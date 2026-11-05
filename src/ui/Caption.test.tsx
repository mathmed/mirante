import { act, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubLibrary } from '../../test/library-stub.ts'
import { showViewer } from '../../test/viewer.ts'
import { RemoteKey } from '../core/remote-key.ts'

const { Right, Left } = RemoteKey
const CAPTIONS = new Map([
  ['p-3', 'Pôr do sol na praia'],
  ['p-5', 'Uma legenda muito longa '.repeat(10)],
])

interface Library {
  readonly asked: string[]
  readonly library: ReturnType<typeof stubLibrary>
}

function captioned(
  read = async (photoId: string) => Promise.resolve(CAPTIONS.get(photoId)),
): Library {
  const asked: string[] = []
  return {
    asked,
    library: stubLibrary({
      readCaption: async (photoId) => {
        asked.push(photoId)
        return read(photoId)
      },
    }),
  }
}

// The reads of the stub library settle in a few microtasks.
const MICROTASKS = 10

async function settled(): Promise<void> {
  await act(async () => {
    for (let tick = 0; tick < MICROTASKS; tick += 1) {
      await Promise.resolve()
    }
  })
}

function caption(): string | null | undefined {
  return document.querySelector('.viewer-caption-text')?.textContent
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Caption', () => {
  it('should show the caption of the photo, read with the next one only', async () => {
    const sut = captioned()

    showViewer({ library: sut.library })
    await settled()

    expect(await screen.findByText('Pôr do sol na praia')).toBeTruthy()
    expect(sut.asked).toStrictEqual(['p-3', 'p-4'])
  })

  it('should show nothing for a photo without a caption, in the same place', async () => {
    const sut = captioned()
    const shown = showViewer({ library: sut.library })
    await settled()

    shown.remote.press(Right)
    await settled()

    expect(caption()).toBeUndefined()
    expect(document.querySelector('.viewer-caption')).not.toBeNull()
    expect(sut.asked).toStrictEqual(['p-3', 'p-4', 'p-5'])
  })

  it('should read each caption once, going back and forth', async () => {
    const sut = captioned()
    const shown = showViewer({ library: sut.library })
    await settled()

    shown.remote.press(Right, Left, Right)
    await settled()

    expect(sut.asked).toStrictEqual(['p-3', 'p-4', 'p-5'])
  })

  it('should cut a long caption to about two lines', async () => {
    const sut = captioned()
    const shown = showViewer({ library: sut.library, start: 3 })

    shown.remote.press(Right)
    await settled()

    expect(caption()).toHaveLength(140)
    expect(caption()?.endsWith('…')).toBe(true)
  })

  it('should never show the caption of a photo the viewer already left', async () => {
    const pending = new Map<string, (caption: string) => void>()
    const sut = captioned(
      async (photoId) =>
        new Promise((resolve) => {
          pending.set(photoId, resolve)
        }),
    )
    const shown = showViewer({ library: sut.library })
    await settled()

    shown.remote.press(Right)
    pending.get('p-3')?.('Legenda que chegou tarde')
    await settled()

    expect(caption()).toBeUndefined()
  })

  it('should log a caption that cannot be read, and show none', async () => {
    const error = new Error('unreachable')
    const sut = captioned(async () => Promise.reject(error))

    const shown = showViewer({ library: sut.library })
    await settled()

    expect(caption()).toBeUndefined()
    expect(shown.reported).toStrictEqual([error, error])
  })

  it('should read no caption when the settings hide them', async () => {
    const sut = captioned()

    showViewer({ library: sut.library, settings: { shouldShowCaption: false } })
    await settled()

    expect(document.querySelector('.viewer-caption')).toBeNull()
    expect(sut.asked).toStrictEqual([])
  })

  it('should read nothing without photos', async () => {
    const sut = captioned()

    showViewer({ library: sut.library, slides: [], start: 0 })
    await settled()

    expect(sut.asked).toStrictEqual([])
  })
})
