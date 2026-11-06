import { BookFormat } from './book-geometry.ts'
import { BookDensity } from './book-pagination.ts'

// How a presentation of photos runs: the interval, the order, the transition and what shows over
// the photo; and how an album looks as a book. config.json may set the defaults (its
// "presentation" block), each TV keeps its own choices (settings-storage.ts), and the settings
// screen changes them.
export const PlaybackOrder = {
  OldestFirst: 'oldest-first',
  NewestFirst: 'newest-first',
  Random: 'random',
} as const

export type PlaybackOrder = (typeof PlaybackOrder)[keyof typeof PlaybackOrder]

export const Transition = {
  Cut: 'cut',
  Fade: 'fade',
  Slide: 'slide',
  // A slow zoom over each photo, with a crossfade between them ("Ken Burns").
  KenBurns: 'ken-burns',
} as const

export type Transition = (typeof Transition)[keyof typeof Transition]

export const ZoomIntensity = {
  Gentle: 'gentle',
  Normal: 'normal',
} as const

export type ZoomIntensity = (typeof ZoomIntensity)[keyof typeof ZoomIntensity]

export interface PresentationSettings {
  readonly intervalSeconds: number
  readonly order: PlaybackOrder
  readonly transition: Transition
  readonly zoom: ZoomIntensity
  readonly shouldShowDate: boolean
  readonly shouldShowCaption: boolean
  readonly shouldShowCounter: boolean
  readonly shouldLoop: boolean
  // How long the date, the counter and the keys stay on the screen after a change.
  readonly hideInterfaceSeconds: number
  // For slow TVs: no zoom, and a plain fade whatever the transition.
  readonly shouldReduceEffects: boolean
  // How many photos the pages of a book hold.
  readonly bookDensity: BookDensity
  // The shape of the pages of a book: full screen, or the classic shape.
  readonly bookFormat: BookFormat
  readonly shouldShowBookCover: boolean
  readonly shouldShowPageNumbers: boolean
  // How long each spread of a book stays on the screen while the book plays.
  readonly bookSpreadSeconds: number
}

// The name of each setting in the "presentation" block of config.json and in the stored settings:
// a public contract, never renamed.
export const SettingName = {
  Interval: 'intervalSeconds',
  Order: 'order',
  Transition: 'transition',
  Zoom: 'zoom',
  ShowDate: 'showDate',
  ShowCaption: 'showCaption',
  ShowCounter: 'showCounter',
  Loop: 'loop',
  HideInterface: 'hideInterfaceSeconds',
  ReduceEffects: 'reduceEffects',
  BookDensity: 'bookDensity',
  BookFormat: 'bookFormat',
  ShowBookCover: 'showBookCover',
  ShowPageNumbers: 'showPageNumbers',
  BookSpread: 'bookSpreadSeconds',
} as const

export type SettingName = (typeof SettingName)[keyof typeof SettingName]

export const SettingKind = {
  Seconds: 'seconds',
  Choice: 'choice',
  Toggle: 'toggle',
} as const

// Whole seconds from min to max: one by one up to fineUntil, then by coarseStep.
export interface SecondsRange {
  readonly min: number
  readonly max: number
  readonly fineUntil: number
  readonly coarseStep: number
}

// A number of seconds, chosen among the steps of its range; any whole number of the range is valid.
export interface SecondsSetting {
  readonly kind: typeof SettingKind.Seconds
  readonly name: SettingName
  readonly range: SecondsRange
  readonly steps: readonly number[]
  readonly valueOf: (settings: PresentationSettings) => number
  readonly withValue: (settings: PresentationSettings, value: number) => PresentationSettings
}

export interface ChoiceSetting {
  readonly kind: typeof SettingKind.Choice
  readonly name: SettingName
  readonly options: readonly [string, ...string[]]
  readonly valueOf: (settings: PresentationSettings) => string
  // Ignores a value that is not one of the options, or none.
  readonly withValue: (
    settings: PresentationSettings,
    value: string | undefined,
  ) => PresentationSettings
}

export interface ToggleSetting {
  readonly kind: typeof SettingKind.Toggle
  readonly name: SettingName
  readonly valueOf: (settings: PresentationSettings) => boolean
  readonly withValue: (settings: PresentationSettings, value: boolean) => PresentationSettings
}

export type Setting = ChoiceSetting | SecondsSetting | ToggleSetting

export const INTERVAL_RANGE: SecondsRange = { min: 3, max: 60, fineUntil: 10, coarseStep: 5 }
export const HIDE_INTERFACE_RANGE: SecondsRange = { min: 3, max: 20, fineUntil: 10, coarseStep: 5 }

export const DEFAULT_PRESENTATION: PresentationSettings = {
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
  bookDensity: BookDensity.Normal,
  bookFormat: BookFormat.Wide,
  shouldShowBookCover: true,
  shouldShowPageNumbers: true,
  bookSpreadSeconds: 10,
}

// In the order of the settings screen.
export const SETTINGS: readonly Setting[] = [
  seconds(SettingName.Interval, INTERVAL_RANGE, {
    valueOf: (settings) => settings.intervalSeconds,
    withValue: (settings, intervalSeconds) => ({ ...settings, intervalSeconds }),
  }),
  choice(
    SettingName.Order,
    [PlaybackOrder.OldestFirst, PlaybackOrder.NewestFirst, PlaybackOrder.Random],
    {
      valueOf: (settings) => settings.order,
      withValue: (settings, order) => ({ ...settings, order }),
    },
  ),
  choice(
    SettingName.Transition,
    [Transition.Cut, Transition.Fade, Transition.Slide, Transition.KenBurns],
    {
      valueOf: (settings) => settings.transition,
      withValue: (settings, transition) => ({ ...settings, transition }),
    },
  ),
  choice(SettingName.Zoom, [ZoomIntensity.Gentle, ZoomIntensity.Normal], {
    valueOf: (settings) => settings.zoom,
    withValue: (settings, zoom) => ({ ...settings, zoom }),
  }),
  toggle(SettingName.ShowDate, {
    valueOf: (settings) => settings.shouldShowDate,
    withValue: (settings, shouldShowDate) => ({ ...settings, shouldShowDate }),
  }),
  toggle(SettingName.ShowCaption, {
    valueOf: (settings) => settings.shouldShowCaption,
    withValue: (settings, shouldShowCaption) => ({ ...settings, shouldShowCaption }),
  }),
  toggle(SettingName.ShowCounter, {
    valueOf: (settings) => settings.shouldShowCounter,
    withValue: (settings, shouldShowCounter) => ({ ...settings, shouldShowCounter }),
  }),
  toggle(SettingName.Loop, {
    valueOf: (settings) => settings.shouldLoop,
    withValue: (settings, shouldLoop) => ({ ...settings, shouldLoop }),
  }),
  seconds(SettingName.HideInterface, HIDE_INTERFACE_RANGE, {
    valueOf: (settings) => settings.hideInterfaceSeconds,
    withValue: (settings, hideInterfaceSeconds) => ({ ...settings, hideInterfaceSeconds }),
  }),
  toggle(SettingName.ReduceEffects, {
    valueOf: (settings) => settings.shouldReduceEffects,
    withValue: (settings, shouldReduceEffects) => ({ ...settings, shouldReduceEffects }),
  }),
  choice(SettingName.BookDensity, [BookDensity.Light, BookDensity.Normal, BookDensity.Dense], {
    valueOf: (settings) => settings.bookDensity,
    withValue: (settings, bookDensity) => ({ ...settings, bookDensity }),
  }),
  choice(SettingName.BookFormat, [BookFormat.Wide, BookFormat.Classic], {
    valueOf: (settings) => settings.bookFormat,
    withValue: (settings, bookFormat) => ({ ...settings, bookFormat }),
  }),
  toggle(SettingName.ShowBookCover, {
    valueOf: (settings) => settings.shouldShowBookCover,
    withValue: (settings, shouldShowBookCover) => ({ ...settings, shouldShowBookCover }),
  }),
  toggle(SettingName.ShowPageNumbers, {
    valueOf: (settings) => settings.shouldShowPageNumbers,
    withValue: (settings, shouldShowPageNumbers) => ({ ...settings, shouldShowPageNumbers }),
  }),
  seconds(SettingName.BookSpread, INTERVAL_RANGE, {
    valueOf: (settings) => settings.bookSpreadSeconds,
    withValue: (settings, bookSpreadSeconds) => ({ ...settings, bookSpreadSeconds }),
  }),
]

// Whole seconds within the range: the limits hold whatever the source.
export function secondsWithin(value: number, range: SecondsRange): number {
  return Math.min(Math.max(Math.round(value), range.min), range.max)
}

// The values the remote control steps through.
export function stepsOf(range: SecondsRange): readonly number[] {
  const steps: number[] = []
  for (let value = range.min; value <= range.fineUntil; value += 1) {
    steps.push(value)
  }
  const firstCoarse = (Math.floor(range.fineUntil / range.coarseStep) + 1) * range.coarseStep
  for (let value = firstCoarse; value <= range.max; value += range.coarseStep) {
    steps.push(value)
  }
  return steps
}

interface Access<T> {
  readonly valueOf: (settings: PresentationSettings) => T
  readonly withValue: (settings: PresentationSettings, value: T) => PresentationSettings
}

function seconds(name: SettingName, range: SecondsRange, access: Access<number>): SecondsSetting {
  return {
    kind: SettingKind.Seconds,
    name,
    range,
    steps: stepsOf(range),
    valueOf: access.valueOf,
    withValue: (settings, value) => access.withValue(settings, secondsWithin(value, range)),
  }
}

function choice<T extends string>(
  name: SettingName,
  options: readonly [T, ...T[]],
  access: Access<T>,
): ChoiceSetting {
  return {
    kind: SettingKind.Choice,
    name,
    options,
    valueOf: access.valueOf,
    withValue: (settings, value) => {
      const option = options.find((candidate) => candidate === value)
      return option === undefined ? settings : access.withValue(settings, option)
    },
  }
}

function toggle(name: SettingName, access: Access<boolean>): ToggleSetting {
  return { kind: SettingKind.Toggle, name, ...access }
}
