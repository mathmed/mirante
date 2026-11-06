import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PRESENTATION,
  PlaybackOrder,
  type PresentationSettings,
  SettingName,
  Transition,
  ZoomIntensity,
} from './presentation-settings.ts'
import { RemoteKey } from './remote-key.ts'
import {
  openSettings,
  pressInSettings,
  RESTORE_ROW,
  rowOf,
  SETTINGS_ROWS,
  type SettingsForm,
} from './settings-form.ts'

const { Up, Down, Left, Right, Enter, Back } = RemoteKey
const DEFAULTS = { ...DEFAULT_PRESENTATION, intervalSeconds: 10 }

function rowNamed(name: SettingName): number {
  return SETTINGS_ROWS.findIndex((row) => row.kind !== RESTORE_ROW.kind && row.name === name)
}

function formOn(name: SettingName, settings: PresentationSettings = DEFAULTS): SettingsForm {
  return { ...openSettings(settings, DEFAULTS), row: rowNamed(name) }
}

function pressing(form: SettingsForm, ...keys: readonly RemoteKey[]): SettingsForm {
  return keys.reduce(pressInSettings, form)
}

describe('openSettings', () => {
  it('should open on the first row with the settings and the defaults', () => {
    expect(openSettings(DEFAULT_PRESENTATION, DEFAULTS)).toStrictEqual({
      settings: DEFAULT_PRESENTATION,
      defaults: DEFAULTS,
      row: 0,
    })
  })
})

describe('SETTINGS_ROWS', () => {
  it('should end on the row that restores the defaults', () => {
    expect(SETTINGS_ROWS).toHaveLength(15)
    expect(SETTINGS_ROWS[SETTINGS_ROWS.length - 1]).toBe(RESTORE_ROW)
  })
})

describe('pressInSettings', () => {
  it('should move down and up the rows, stopping at both ends', () => {
    const sut = openSettings(DEFAULTS, DEFAULTS)

    expect(pressing(sut, Up).row).toBe(0)
    expect(pressing(sut, Down, Down).row).toBe(2)
    expect(pressing(sut, Down, Down, Up).row).toBe(1)
    expect(pressing(sut, ...Array<RemoteKey>(20).fill(Down)).row).toBe(SETTINGS_ROWS.length - 1)
  })

  it('should step the interval through its steps, stopping at the limits', () => {
    const sut = formOn(SettingName.Interval)

    expect(pressing(sut, Right).settings.intervalSeconds).toBe(15)
    expect(pressing(sut, Left).settings.intervalSeconds).toBe(9)
    expect(pressing(sut, ...Array<RemoteKey>(20).fill(Right)).settings.intervalSeconds).toBe(60)
    expect(pressing(sut, ...Array<RemoteKey>(20).fill(Left)).settings.intervalSeconds).toBe(3)
  })

  it('should step from a value between two steps to the nearest step that way', () => {
    const sut = formOn(SettingName.Interval, { ...DEFAULTS, intervalSeconds: 12 })

    expect(pressing(sut, Right).settings.intervalSeconds).toBe(15)
    expect(pressing(sut, Left).settings.intervalSeconds).toBe(10)
  })

  it('should step the time before the interface hides', () => {
    const sut = formOn(SettingName.HideInterface)

    expect(pressing(sut, Right).settings.hideInterfaceSeconds).toBe(5)
    expect(pressing(sut, Left).settings.hideInterfaceSeconds).toBe(3)
    expect(pressing(sut, Left, Left).settings.hideInterfaceSeconds).toBe(3)
  })

  it('should go through the options of a choice, around both ends', () => {
    const sut = formOn(SettingName.Order)

    expect(pressing(sut, Right).settings.order).toBe(PlaybackOrder.NewestFirst)
    expect(pressing(sut, Right, Right).settings.order).toBe(PlaybackOrder.Random)
    expect(pressing(sut, Right, Right, Right).settings.order).toBe(PlaybackOrder.OldestFirst)
    expect(pressing(sut, Left).settings.order).toBe(PlaybackOrder.Random)
  })

  it('should go to the next option of a choice on Enter', () => {
    expect(pressing(formOn(SettingName.Transition), Enter).settings.transition).toBe(
      Transition.Slide,
    )
    expect(pressing(formOn(SettingName.Zoom), Enter, Enter).settings.zoom).toBe(
      ZoomIntensity.Gentle,
    )
  })

  it.each([Left, Right, Enter])('should flip a switch on %s', (key) => {
    expect(pressing(formOn(SettingName.Loop), key).settings.shouldLoop).toBe(false)
    expect(pressing(formOn(SettingName.ReduceEffects), key, key).settings.shouldReduceEffects).toBe(
      false,
    )
  })

  it('should leave a number of seconds alone on Enter', () => {
    const sut = formOn(SettingName.Interval)

    expect(pressing(sut, Enter)).toStrictEqual(sut)
  })

  it('should restore the defaults on Enter on the last row, and only there', () => {
    const changed = { ...DEFAULT_PRESENTATION, order: PlaybackOrder.Random, shouldLoop: false }
    const sut = { ...openSettings(changed, DEFAULTS), row: SETTINGS_ROWS.length - 1 }

    expect(rowOf(sut)).toBe(RESTORE_ROW)
    expect(pressing(sut, Left, Right).settings).toBe(changed)
    expect(pressing(sut, Enter)).toStrictEqual({ ...sut, settings: DEFAULTS })
  })

  it('should leave Back to the screen', () => {
    const sut = formOn(SettingName.Order)

    expect(pressInSettings(sut, Back)).toBe(sut)
  })
})

describe('rowOf', () => {
  it('should give the row the form is on', () => {
    expect(rowOf(formOn(SettingName.ShowCaption))).toMatchObject({ name: SettingName.ShowCaption })
  })

  it('should give the last row for a row past the end', () => {
    expect(rowOf({ ...openSettings(DEFAULTS, DEFAULTS), row: 99 })).toBe(RESTORE_ROW)
  })
})
