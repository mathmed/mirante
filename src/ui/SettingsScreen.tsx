import type { JSX } from 'preact'
import { useCallback } from 'preact/hooks'

import type { PresentationSettings } from '../core/presentation-settings.ts'
import { Frame } from './Frame.tsx'
import { MESSAGES } from './messages.ts'
import type { ScreenProps } from './screen-props.ts'
import { SettingsPanel } from './SettingsPanel.tsx'

// The settings of the presentations, from the start screen: Back keeps them and goes back.
export function SettingsScreen({ keys, back, presentation }: ScreenProps): JSX.Element {
  const { saveSettings } = presentation
  const close = useCallback(
    (settings: PresentationSettings) => {
      saveSettings(settings)
      back()
    },
    [saveSettings, back],
  )
  return (
    <Frame title={MESSAGES.settings}>
      <SettingsPanel
        settings={presentation.settings}
        defaults={presentation.defaults}
        keys={keys}
        onClose={close}
      />
    </Frame>
  )
}
