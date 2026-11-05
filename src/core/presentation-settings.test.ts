import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PRESENTATION,
  HIDE_INTERFACE_RANGE,
  INTERVAL_RANGE,
  PlaybackOrder,
  secondsWithin,
  type Setting,
  SettingKind,
  SettingName,
  SETTINGS,
  stepsOf,
  Transition,
  ZoomIntensity,
} from './presentation-settings.ts'

function settingNamed(name: SettingName): Setting {
  const setting = SETTINGS.find((candidate) => candidate.name === name)
  if (setting === undefined) {
    throw new Error(`no setting ${name}`)
  }
  return setting
}

describe('DEFAULT_PRESENTATION', () => {
  it('should play every 8 seconds, by date, with a fade, showing everything, in a loop', () => {
    expect(DEFAULT_PRESENTATION).toStrictEqual({
      intervalSeconds: 8,
      order: PlaybackOrder.OldestFirst,
      transition: Transition.Fade,
      zoom: ZoomIntensity.Gentle,
      shouldShowDate: true,
      shouldShowCaption: true,
      shouldShowCounter: true,
      shouldLoop: true,
      hideInterfaceSeconds: 4,
      shouldReduceEffects: false,
    })
  })
})

describe('SETTINGS', () => {
  it('should list every setting once, in the order of the screen', () => {
    expect(SETTINGS.map((setting) => setting.name)).toStrictEqual([
      'intervalSeconds',
      'order',
      'transition',
      'zoom',
      'showDate',
      'showCaption',
      'showCounter',
      'loop',
      'hideInterfaceSeconds',
      'reduceEffects',
    ])
  })

  it('should step the interval from 3 to 60 seconds and the interface from 3 to 20', () => {
    expect(settingNamed(SettingName.Interval)).toMatchObject({
      range: INTERVAL_RANGE,
      steps: [3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
    })
    expect(settingNamed(SettingName.HideInterface)).toMatchObject({
      range: HIDE_INTERFACE_RANGE,
      steps: [3, 4, 5, 6, 7, 8, 9, 10, 15, 20],
    })
  })

  it.each([
    [SettingName.Order, ['oldest-first', 'newest-first', 'random']],
    [SettingName.Transition, ['cut', 'fade', 'slide', 'ken-burns']],
    [SettingName.Zoom, ['gentle', 'normal']],
  ])('should offer the options of %s', (name, options) => {
    expect(settingNamed(name)).toMatchObject({ kind: SettingKind.Choice, options })
  })

  it.each([
    [SettingName.Interval, 30, { intervalSeconds: 30 }],
    [SettingName.Order, PlaybackOrder.NewestFirst, { order: PlaybackOrder.NewestFirst }],
    [SettingName.Transition, Transition.Slide, { transition: Transition.Slide }],
    [SettingName.Zoom, ZoomIntensity.Normal, { zoom: ZoomIntensity.Normal }],
    [SettingName.ShowDate, false, { shouldShowDate: false }],
    [SettingName.ShowCaption, false, { shouldShowCaption: false }],
    [SettingName.ShowCounter, false, { shouldShowCounter: false }],
    [SettingName.Loop, false, { shouldLoop: false }],
    [SettingName.HideInterface, 12, { hideInterfaceSeconds: 12 }],
    [SettingName.ReduceEffects, true, { shouldReduceEffects: true }],
  ])('should read and write %s', (name, value, change) => {
    const sut = settingNamed(name)
    const changed = { ...DEFAULT_PRESENTATION, ...change }

    expect(write(sut, value)).toStrictEqual(changed)
    expect(sut.valueOf(changed)).toBe(value)
  })

  it.each([
    [SettingName.Interval, 61, 60],
    [SettingName.Interval, 1, 3],
    [SettingName.Interval, 7.6, 8],
    [SettingName.HideInterface, 30, 20],
    [SettingName.HideInterface, 2.4, 3],
  ])('should keep %s within its limits: %d becomes %d', (name, value, kept) => {
    expect(settingNamed(name).valueOf(write(settingNamed(name), value))).toBe(kept)
  })

  it('should ignore an option a choice does not have', () => {
    expect(write(settingNamed(SettingName.Order), 'shuffled')).toBe(DEFAULT_PRESENTATION)
  })
})

describe('stepsOf', () => {
  it('should step one by one, then by the coarse step from its next multiple, up to the max', () => {
    expect(stepsOf({ min: 2, max: 31, fineUntil: 4, coarseStep: 10 })).toStrictEqual([
      2, 3, 4, 10, 20, 30,
    ])
    expect(stepsOf({ min: 1, max: 30, fineUntil: 10, coarseStep: 10 })).toStrictEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30,
    ])
  })
})

describe('secondsWithin', () => {
  it.each([
    [2, 3],
    [3, 3],
    [7, 7],
    [7.5, 8],
    [60, 60],
    [61, 60],
  ])('should bring %d within 3 and 60 seconds as %d', (value, kept) => {
    expect(secondsWithin(value, INTERVAL_RANGE)).toBe(kept)
  })
})

function write(setting: Setting, value: boolean | number | string): typeof DEFAULT_PRESENTATION {
  switch (setting.kind) {
    case SettingKind.Seconds:
      return setting.withValue(DEFAULT_PRESENTATION, Number(value))
    case SettingKind.Choice:
      return setting.withValue(DEFAULT_PRESENTATION, String(value))
    default:
      return setting.withValue(DEFAULT_PRESENTATION, value === true)
  }
}
