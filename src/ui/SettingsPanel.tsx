import type { JSX } from 'preact'
import { useCallback, useState } from 'preact/hooks'

import type { PresentationSettings } from '../core/presentation-settings.ts'
import { type KeySource, RemoteKey } from '../core/remote-key.ts'
import { openSettings, pressInSettings, rowOf, type SettingsForm } from '../core/settings-form.ts'
import { MESSAGES } from './messages.ts'
import { settingPreview } from './settings-messages.ts'
import { SettingsList } from './SettingsList.tsx'
import { useRemoteKeys } from './use-remote-keys.ts'

export interface SettingsPanelProps {
  readonly settings: PresentationSettings
  readonly defaults: PresentationSettings
  readonly keys: KeySource
  // Back: the settings as they are now, to keep.
  readonly onClose: (settings: PresentationSettings) => void
}

// The settings of the presentations, as a list the remote control walks: the value of each row is
// always on the screen, and what the focused one does is written under the list.
export function SettingsPanel(props: SettingsPanelProps): JSX.Element {
  const [form, setForm] = useState(() => openSettings(props.settings, props.defaults))
  useSettingsKeys(props, form, setForm)
  const focused = rowOf(form)
  return (
    <section class="settings" aria-label={MESSAGES.settings}>
      <SettingsList form={form} />
      <div class="settings-side">
        <p class="settings-preview" aria-live="polite">
          {settingPreview(focused, form.settings)}
        </p>
        <p class="settings-keys">{MESSAGES.settingsKeys}</p>
      </div>
    </section>
  )
}

type SetForm = (update: (previous: SettingsForm) => SettingsForm) => void

function useSettingsKeys(props: SettingsPanelProps, form: SettingsForm, setForm: SetForm): void {
  const { onClose } = props
  const onKey = useCallback(
    (key: RemoteKey) => {
      if (key === RemoteKey.Back) {
        onClose(form.settings)
      } else {
        setForm((previous) => pressInSettings(previous, key))
      }
    },
    [form.settings, onClose, setForm],
  )
  useRemoteKeys(props.keys, onKey)
}
