import {
  type ChoiceSetting,
  type PresentationSettings,
  type SecondsSetting,
  type Setting,
  SettingKind,
  SETTINGS,
  type ToggleSetting,
} from './presentation-settings.ts'

type Update = (settings: PresentationSettings) => PresentationSettings

const NO_FIELDS: ReadonlyMap<string, unknown> = new Map()

// The "presentation" block of config.json, over the defaults of the app. Strict, like the rest of
// the file: a field of the wrong type, an unknown option or a number of seconds out of its limits
// makes the whole block invalid (undefined), so that a typo never goes unnoticed. Fields it does not
// know are left alone.
export function parsePresentation(
  fields: ReadonlyMap<string, unknown> | undefined,
  defaults: PresentationSettings,
): PresentationSettings | undefined {
  if (fields === undefined) {
    return undefined
  }
  return SETTINGS.reduce<PresentationSettings | undefined>(
    (settings, setting) =>
      settings === undefined ? undefined : strictField(settings, setting, fields.get(setting.name)),
    defaults,
  )
}

// Settings the app wrote itself, maybe by an older version: lenient, each field that is missing or
// of the wrong type keeps its default, and numbers are brought within their limits.
export function restoredSettings(
  fields: ReadonlyMap<string, unknown> | undefined,
  defaults: PresentationSettings,
): PresentationSettings {
  const known = fields ?? NO_FIELDS
  return SETTINGS.reduce(
    (settings, setting) => updateOf(setting, known.get(setting.name))?.(settings) ?? settings,
    defaults,
  )
}

function strictField(
  settings: PresentationSettings,
  setting: Setting,
  value: unknown,
): PresentationSettings | undefined {
  if (value === undefined) {
    return settings
  }
  const update = isOutOfLimits(setting, value) ? undefined : updateOf(setting, value)
  return update?.(settings)
}

function isOutOfLimits(setting: Setting, value: unknown): boolean {
  if (setting.kind !== SettingKind.Seconds || typeof value !== 'number') {
    return false
  }
  return value < setting.range.min || value > setting.range.max
}

// The change a value makes, when it has the type of the setting: a finite number of seconds, one of
// the options, true or false.
function updateOf(setting: Setting, value: unknown): Update | undefined {
  switch (setting.kind) {
    case SettingKind.Seconds:
      return secondsUpdate(setting, value)
    case SettingKind.Choice:
      return choiceUpdate(setting, value)
    default:
      return toggleUpdate(setting, value)
  }
}

function secondsUpdate(setting: SecondsSetting, value: unknown): Update | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return (settings) => setting.withValue(settings, value)
}

function choiceUpdate(setting: ChoiceSetting, value: unknown): Update | undefined {
  if (typeof value !== 'string' || !setting.options.includes(value)) {
    return undefined
  }
  return (settings) => setting.withValue(settings, value)
}

function toggleUpdate(setting: ToggleSetting, value: unknown): Update | undefined {
  if (typeof value !== 'boolean') {
    return undefined
  }
  return (settings) => setting.withValue(settings, value)
}
