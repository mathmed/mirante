import type { JSX } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import type { PresentationSettings } from '../core/presentation-settings.ts'
import { type KeySource, RemoteKey } from '../core/remote-key.ts'
import {
  openSettings,
  pressInSettings,
  RESTORE_ROW,
  rowOf,
  SETTINGS_ROWS,
  type SettingsForm,
  type SettingsRow,
} from '../core/settings-form.ts'
import { MESSAGES } from './messages.ts'
import { settingLabel, settingPreview, settingValueText } from './settings-messages.ts'
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
      <ul class="settings-list">
        {SETTINGS_ROWS.map((row, index) => (
          <SettingRow key={keyOf(row)} row={row} form={form} isFocused={index === form.row} />
        ))}
      </ul>
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

interface SettingRowProps {
  readonly row: SettingsRow
  readonly form: SettingsForm
  readonly isFocused: boolean
}

// The focused row holds the browser's focus, so that :focus shows where the remote control is.
function SettingRow({ row, form, isFocused }: SettingRowProps): JSX.Element {
  const rowRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (isFocused) {
      rowRef.current?.focus({ preventScroll: true })
    }
  }, [isFocused])
  const isRestore = row.kind === RESTORE_ROW.kind
  return (
    <li
      ref={rowRef}
      class={isRestore ? 'setting setting-restore' : 'setting'}
      tabIndex={-1}
      aria-current={isFocused}
    >
      <span class="setting-label">{settingLabel(row)}</span>
      {row.kind !== RESTORE_ROW.kind && (
        <span class="setting-value">{settingValueText(row, form.settings)}</span>
      )}
    </li>
  )
}

function keyOf(row: SettingsRow): string {
  return row.kind === RESTORE_ROW.kind ? RESTORE_ROW.kind : row.name
}
