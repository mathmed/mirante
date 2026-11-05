import { describe, expect, it } from 'vitest'

import { fieldsOf } from './json.ts'
import {
  DEFAULT_PRESENTATION,
  PlaybackOrder,
  type PresentationSettings,
  Transition,
  ZoomIntensity,
} from './presentation-settings.ts'
import { parsePresentation, restoredSettings } from './settings-input.ts'

const EVERY_FIELD = {
  intervalSeconds: 20,
  order: 'random',
  transition: 'ken-burns',
  zoom: 'normal',
  showDate: false,
  showCaption: false,
  showCounter: false,
  loop: false,
  hideInterfaceSeconds: 10,
  reduceEffects: true,
}

const EVERY_SETTING: PresentationSettings = {
  intervalSeconds: 20,
  order: PlaybackOrder.Random,
  transition: Transition.KenBurns,
  zoom: ZoomIntensity.Normal,
  shouldShowDate: false,
  shouldShowCaption: false,
  shouldShowCounter: false,
  shouldLoop: false,
  hideInterfaceSeconds: 10,
  shouldReduceEffects: true,
}

describe('parsePresentation', () => {
  it('should read every field', () => {
    expect(parsePresentation(fieldsOf(EVERY_FIELD), DEFAULT_PRESENTATION)).toStrictEqual(
      EVERY_SETTING,
    )
  })

  it('should keep the defaults it is given for the fields left out, and ignore unknown ones', () => {
    const defaults = { ...DEFAULT_PRESENTATION, intervalSeconds: 12 }

    expect(parsePresentation(fieldsOf({ loop: false, music: 'on' }), defaults)).toStrictEqual({
      ...defaults,
      shouldLoop: false,
    })
  })

  it.each([
    [3, 3],
    [60, 60],
    [12.4, 12],
  ])('should read the interval %d as %d seconds', (intervalSeconds, expected) => {
    expect(
      parsePresentation(fieldsOf({ intervalSeconds }), DEFAULT_PRESENTATION)?.intervalSeconds,
    ).toBe(expected)
  })

  it.each([
    { intervalSeconds: 2.9 },
    { intervalSeconds: 60.1 },
    { intervalSeconds: '8' },
    { intervalSeconds: null },
    { hideInterfaceSeconds: 21 },
    { hideInterfaceSeconds: 2 },
    { order: 'shuffled' },
    { order: 1 },
    { transition: 'dissolve' },
    { zoom: 'strong' },
    { showDate: 'yes' },
    { loop: 1 },
    { reduceEffects: null },
  ])('should reject %j', (fields) => {
    expect(parsePresentation(fieldsOf(fields), DEFAULT_PRESENTATION)).toBeUndefined()
  })

  it('should reject what is not an object', () => {
    expect(parsePresentation(undefined, DEFAULT_PRESENTATION)).toBeUndefined()
  })
})

describe('restoredSettings', () => {
  it('should read every field', () => {
    expect(restoredSettings(fieldsOf(EVERY_FIELD), DEFAULT_PRESENTATION)).toStrictEqual(
      EVERY_SETTING,
    )
  })

  it('should keep the default of each field that is missing or of the wrong type', () => {
    const fields = { ...EVERY_FIELD, order: 'shuffled', showDate: 'no', intervalSeconds: '9' }

    expect(restoredSettings(fieldsOf(fields), DEFAULT_PRESENTATION)).toStrictEqual({
      ...EVERY_SETTING,
      order: DEFAULT_PRESENTATION.order,
      shouldShowDate: DEFAULT_PRESENTATION.shouldShowDate,
      intervalSeconds: DEFAULT_PRESENTATION.intervalSeconds,
    })
  })

  it.each([
    [{ intervalSeconds: 600 }, { intervalSeconds: 60 }],
    [{ intervalSeconds: 0 }, { intervalSeconds: 3 }],
    [{ hideInterfaceSeconds: 99 }, { hideInterfaceSeconds: 20 }],
    [{ intervalSeconds: Number.NaN }, {}],
  ])('should bring %j within the limits', (fields, change) => {
    expect(restoredSettings(fieldsOf(fields), DEFAULT_PRESENTATION)).toStrictEqual({
      ...DEFAULT_PRESENTATION,
      ...change,
    })
  })

  it('should keep the defaults for nothing', () => {
    expect(restoredSettings(undefined, DEFAULT_PRESENTATION)).toBe(DEFAULT_PRESENTATION)
  })
})
