import { screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { elapse, settled } from '../../test/book.ts'
import { barActions, gridPhotos, showEditing } from '../../test/editing.ts'
import { focusedOn, title, TRIP } from '../../test/gallery.ts'
import { ScreenKind } from '../core/navigation.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { homeTitle, MESSAGES } from './messages.ts'

const { Up, Right, Enter, Back } = RemoteKey
const NOTICE_MS = 6000
const UNDO_MS = 30_000

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// The trip, its first photo sent to the trash.
async function trashFirst(sut: ReturnType<typeof showEditing>): Promise<void> {
  await settled()
  await focusedOn(homeTitle(ScreenKind.AllPhotos))
  sut.remote.press(Right, Enter)
  await settled()
  await title(MESSAGES.albums)
  sut.remote.press(Right, Enter)
  await settled()
  await title(TRIP.name)
  sut.remote.press(Up, Enter, Enter, Back, Right, Right, Enter, Right, Enter)
  await settled()
}

describe('what a change says, and its undo', () => {
  it('should say what happened for a while, then go', async () => {
    const sut = showEditing()
    await trashFirst(sut)

    expect(screen.getByRole('status').textContent).toBe(
      '1 foto foi para a lixeira do Immich · ↑ Desfazer',
    )
    await elapse(NOTICE_MS)

    expect(document.querySelector('.notice')).toBeNull()
    expect(barActions()[0]).toBe('Desfazer')
  })

  it('should offer the undo for a while only', async () => {
    const sut = showEditing()
    await trashFirst(sut)
    expect(gridPhotos()[0]).toBe('trip-2')

    await elapse(UNDO_MS)

    expect(barActions()).toStrictEqual(['Selecionar', 'Renomear álbum', 'Apagar álbum'])
    expect(sut.calls).toStrictEqual(['trashPhotos [["trip-1"]]'])
  })
})
