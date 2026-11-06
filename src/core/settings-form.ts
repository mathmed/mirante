import {
  type ChoiceSetting,
  type PresentationSettings,
  type SecondsSetting,
  type Setting,
  SettingKind,
  SettingName,
  SETTINGS,
} from './presentation-settings.ts'
import { RemoteKey } from './remote-key.ts'

// The settings screen: a list driven by the remote control. Up and down choose the row, left and
// right change its value, Enter flips a switch (and steps through the options of a choice), and the
// last row restores the defaults. Back, handled by the screen, keeps the settings and leaves.

export const RESTORE_ROW = { kind: 'restore' } as const

export type SettingsRow = Setting | typeof RESTORE_ROW

// The rows are grouped under small titles, for a long list to read well: the presentations, the
// photo book, and what holds for both, which ends on the row that restores the defaults.
export const SettingsSection = {
  Presentation: 'presentation',
  Book: 'book',
  General: 'general',
} as const

export type SettingsSection = (typeof SettingsSection)[keyof typeof SettingsSection]

export interface SettingsGroup {
  readonly section: SettingsSection
  readonly rows: readonly SettingsRow[]
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  group(SettingsSection.Presentation, [
    SettingName.Interval,
    SettingName.Order,
    SettingName.Transition,
    SettingName.Zoom,
    SettingName.ShowDate,
    SettingName.ShowCaption,
    SettingName.ShowCounter,
    SettingName.Loop,
  ]),
  group(SettingsSection.Book, [
    SettingName.BookDensity,
    SettingName.BookFormat,
    SettingName.ShowBookCover,
    SettingName.ShowPageNumbers,
    SettingName.BookSpread,
  ]),
  group(
    SettingsSection.General,
    [SettingName.HideInterface, SettingName.ReduceEffects],
    RESTORE_ROW,
  ),
]

// The rows in the order the remote control walks them.
export const SETTINGS_ROWS: readonly SettingsRow[] = SETTINGS_GROUPS.reduce<readonly SettingsRow[]>(
  (rows, { rows: more }) => [...rows, ...more],
  [],
)

function group(
  section: SettingsSection,
  names: readonly SettingName[],
  ...extra: readonly SettingsRow[]
): SettingsGroup {
  const settings = names.map((name) => SETTINGS.find((setting) => setting.name === name))
  return { section, rows: [...settings.filter((setting) => setting !== undefined), ...extra] }
}

export interface SettingsForm {
  readonly settings: PresentationSettings
  readonly row: number
  // What "restore" goes back to: the defaults of config.json, or the app's.
  readonly defaults: PresentationSettings
}

const Step = { Back: -1, Forward: 1 } as const
type Step = (typeof Step)[keyof typeof Step]

type Press = (form: SettingsForm) => SettingsForm

const PRESSES: ReadonlyMap<RemoteKey, Press> = new Map<RemoteKey, Press>([
  [RemoteKey.Up, (form) => ({ ...form, row: Math.max(0, form.row - 1) })],
  [RemoteKey.Down, (form) => ({ ...form, row: Math.min(SETTINGS_ROWS.length - 1, form.row + 1) })],
  [RemoteKey.Left, (form) => changeRow(form, Step.Back)],
  [RemoteKey.Right, (form) => changeRow(form, Step.Forward)],
  [RemoteKey.Enter, pressEnter],
])

export function openSettings(
  settings: PresentationSettings,
  defaults: PresentationSettings,
): SettingsForm {
  return { settings, defaults, row: 0 }
}

export function rowOf(form: SettingsForm): SettingsRow {
  return SETTINGS_ROWS[form.row] ?? RESTORE_ROW
}

export function pressInSettings(form: SettingsForm, key: RemoteKey): SettingsForm {
  return PRESSES.get(key)?.(form) ?? form
}

// The next or previous value of a setting: the next step of seconds (staying at the limits), the
// next option of a choice (around again after the last), the other side of a switch.
function changeSetting(
  settings: PresentationSettings,
  setting: Setting,
  step: Step,
): PresentationSettings {
  switch (setting.kind) {
    case SettingKind.Seconds:
      return setting.withValue(settings, nextSeconds(setting, setting.valueOf(settings), step))
    case SettingKind.Choice:
      return setting.withValue(settings, nextOption(setting, setting.valueOf(settings), step))
    default:
      return setting.withValue(settings, !setting.valueOf(settings))
  }
}

function changeRow(form: SettingsForm, step: Step): SettingsForm {
  const row = rowOf(form)
  if (row.kind === RESTORE_ROW.kind) {
    return form
  }
  return { ...form, settings: changeSetting(form.settings, row, step) }
}

function pressEnter(form: SettingsForm): SettingsForm {
  const row = rowOf(form)
  switch (row.kind) {
    case RESTORE_ROW.kind:
      return { ...form, settings: form.defaults }
    case SettingKind.Seconds:
      return form
    default:
      return changeRow(form, Step.Forward)
  }
}

function nextSeconds(setting: SecondsSetting, value: number, step: Step): number {
  const candidates = step === Step.Forward ? setting.steps : [...setting.steps].reverse()
  return candidates.find((candidate) => step * (candidate - value) > 0) ?? value
}

// After the last option comes the first one again.
function nextOption(setting: ChoiceSetting, value: string, step: Step): string | undefined {
  const ordered = step === Step.Forward ? [...setting.options] : [...setting.options].reverse()
  const [next] = [...ordered, ...ordered].slice(ordered.indexOf(value) + 1)
  return next
}
