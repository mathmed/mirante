import { fieldsOf, parseJson } from './json.ts'
import { type PresentationSettings, SETTINGS } from './presentation-settings.ts'
import { restoredSettings } from './settings-input.ts'

// Where each TV keeps its settings (localStorage, in src/platform): text in, text out. Either call
// may throw (a full or a forbidden storage).
export interface TextStorage {
  readonly read: () => string | undefined
  readonly write: (text: string) => void
}

// Raised whenever the shape of the stored settings changes in a way an older reader cannot follow;
// settings of another version are dropped for the defaults.
export const STORED_SETTINGS_VERSION = 1

// The settings this TV chose, over the defaults. Nothing stored, text that is not JSON, another
// version or a storage that fails: the defaults, safely. A failure goes to the log.
export function restoreSettings(
  storage: TextStorage,
  defaults: PresentationSettings,
  reportError: (error: unknown) => void,
): PresentationSettings {
  try {
    return settingsFromText(storage.read(), defaults)
  } catch (error) {
    reportError(error)
    return defaults
  }
}

// Best effort: settings that cannot be kept still apply until the app closes.
export function persistSettings(
  storage: TextStorage,
  settings: PresentationSettings,
  reportError: (error: unknown) => void,
): void {
  try {
    storage.write(storedText(settings))
  } catch (error) {
    reportError(error)
  }
}

export function storedText(settings: PresentationSettings): string {
  const fields = SETTINGS.reduce(
    (stored, setting) => ({ ...stored, [setting.name]: setting.valueOf(settings) }),
    {},
  )
  return JSON.stringify({ version: STORED_SETTINGS_VERSION, settings: fields })
}

export function settingsFromText(
  text: string | undefined,
  defaults: PresentationSettings,
): PresentationSettings {
  const stored = fieldsOf(text === undefined ? undefined : parseJson(text))
  if (stored?.get('version') !== STORED_SETTINGS_VERSION) {
    return defaults
  }
  return restoredSettings(fieldsOf(stored.get('settings')), defaults)
}
