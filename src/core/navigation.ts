import type { TimelineYear } from './gallery.ts'
import { type GridPosition, START_POSITION } from './grid.ts'
import type { Album, TimelineMonth } from './photo-library.ts'

export const ScreenKind = {
  Home: 'home',
  Albums: 'albums',
  Album: 'album',
  Years: 'years',
  Months: 'months',
  Month: 'month',
} as const

export type ScreenKind = (typeof ScreenKind)[keyof typeof ScreenKind]

export type Screen =
  | { readonly kind: typeof ScreenKind.Home }
  | { readonly kind: typeof ScreenKind.Albums }
  | { readonly kind: typeof ScreenKind.Album; readonly album: Album }
  | { readonly kind: typeof ScreenKind.Years }
  | { readonly kind: typeof ScreenKind.Months; readonly year: TimelineYear }
  | { readonly kind: typeof ScreenKind.Month; readonly month: TimelineMonth }

// A screen and where its focus was when another screen opened over it.
interface NavigationEntry {
  readonly screen: Screen
  readonly position: GridPosition
}

// The screens opened from the start screen, the last one on top: Back returns to the one below,
// with the focus where it was.
export interface Navigation {
  readonly current: NavigationEntry
  readonly below: readonly NavigationEntry[]
}

// Who asks to open a screen: the screen on top, at its depth, with its focus.
export interface Opener {
  readonly depth: number
  readonly position: GridPosition
}

export const HOME: Screen = { kind: ScreenKind.Home }

// What the start screen opens: the albums, and the timeline by year.
export type HomeEntry =
  { readonly kind: typeof ScreenKind.Albums } | { readonly kind: typeof ScreenKind.Years }

export const HOME_ENTRIES: readonly HomeEntry[] = [
  { kind: ScreenKind.Albums },
  { kind: ScreenKind.Years },
]

export function startNavigation(): Navigation {
  return { current: { screen: HOME, position: START_POSITION }, below: [] }
}

// How many screens lie below the current one: 0 on the start screen.
export function depthOf(navigation: Navigation): number {
  return navigation.below.length
}

// A request from a screen that is no longer on top (a key pressed twice before the screen changed)
// changes nothing, so that a screen never opens twice.
export function openScreen(navigation: Navigation, opener: Opener, screen: Screen): Navigation {
  if (opener.depth !== depthOf(navigation)) {
    return navigation
  }
  const left = { screen: navigation.current.screen, position: opener.position }
  return { current: { screen, position: START_POSITION }, below: [...navigation.below, left] }
}

// Back from the screen at this depth; the start screen stays, and so does a stale request.
export function goBack(navigation: Navigation, depth: number): Navigation {
  const previous = navigation.below[depth - 1]
  if (depth !== depthOf(navigation) || previous === undefined) {
    return navigation
  }
  return { current: previous, below: navigation.below.slice(0, depth - 1) }
}
