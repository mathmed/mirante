import { screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { focused, focusedOn, showGallery, title } from '../../test/gallery.ts'
import { ScreenKind } from '../core/navigation.ts'
import { DEFAULT_PRESENTATION, PlaybackOrder } from '../core/presentation-settings.ts'
import { RemoteKey } from '../core/remote-key.ts'
import { storedText } from '../core/settings-storage.ts'
import { homeTitle, MESSAGES } from './messages.ts'

const { Right, Down, Enter, Back } = RemoteKey

async function settingsScreen(
  options: Parameters<typeof showGallery>[0] = {},
): Promise<ReturnType<typeof showGallery>> {
  const sut = showGallery(options)
  await focusedOn(homeTitle(ScreenKind.AllPhotos))
  sut.remote.press(Right, Right, Right, Right, Enter)
  await title(MESSAGES.settings)
  return sut
}

describe('SettingsScreen', () => {
  it('should open from the start screen on the first setting', async () => {
    await settingsScreen()

    await focusedOn('Tempo de cada foto8 s')
    expect(screen.getAllByRole('listitem')).toHaveLength(15)
  })

  it('should keep the settings on the TV on Back, and return to its card', async () => {
    const sut = await settingsScreen()

    sut.remote.press(Right, Down, Right, Back)

    await focusedOn(MESSAGES.settings)
    expect(sut.written).toStrictEqual([
      storedText({ ...DEFAULT_PRESENTATION, intervalSeconds: 9, order: PlaybackOrder.NewestFirst }),
    ])
    sut.remote.press(Enter)
    await title(MESSAGES.settings)
    await focusedOn('Tempo de cada foto9 s')
  })

  it('should open with the settings the TV kept', async () => {
    const stored = storedText({ ...DEFAULT_PRESENTATION, order: PlaybackOrder.Random })
    const sut = await settingsScreen({ stored })

    sut.remote.press(Down)

    await focusedOn('OrdemAleatória')
  })

  it('should restore the defaults of config.json', async () => {
    const defaults = { ...DEFAULT_PRESENTATION, intervalSeconds: 20 }
    const stored = storedText({ ...defaults, intervalSeconds: 5 })
    const sut = await settingsScreen({ defaults, stored })
    await focusedOn('Tempo de cada foto5 s')

    sut.remote.press(...Array<RemoteKey>(14).fill(Down), Enter, Back)

    await focusedOn(MESSAGES.settings)
    expect(sut.written).toStrictEqual([storedText(defaults)])
    expect(focused()).toBe(MESSAGES.settings)
  })
})
