import type { BookSource } from './book-source.ts'
import type { TimelineYear } from './gallery.ts'
import { type GridPosition, START_POSITION } from './grid.ts'
import type { Album, TimelineMonth } from './photo-library.ts'
import { LIBRARY_SOURCE, type PresentationSource, SourceKind } from './presentation-source.ts'

export const ScreenKind = {
  Home: 'home',
  // Every photo of the library, the most recent first.
  AllPhotos: 'all-photos',
  Albums: 'albums',
  Album: 'album',
  Years: 'years',
  Months: 'months',
  Month: 'month',
  // The choices of a presentation: the whole library, an album, a year or a month.
  Present: 'present',
  Presentation: 'presentation',
  Settings: 'settings',
  // An album or a month as a book of photos.
  Book: 'book',
} as const

export type ScreenKind = (typeof ScreenKind)[keyof typeof ScreenKind]

// Why the albums or the timeline are open: to browse them, or to choose what to present.
export const Intent = {
  Browse: 'browse',
  PresentAlbum: 'present-album',
  PresentYear: 'present-year',
  PresentMonth: 'present-month',
  BookAlbum: 'book-album',
  BookMonth: 'book-month',
} as const

export type Intent = (typeof Intent)[keyof typeof Intent]

export type Screen =
  | { readonly kind: typeof ScreenKind.Album; readonly album: Album }
  | { readonly kind: typeof ScreenKind.AllPhotos }
  | { readonly kind: typeof ScreenKind.Albums; readonly intent: Intent }
  | { readonly kind: typeof ScreenKind.Home }
  | { readonly kind: typeof ScreenKind.Month; readonly month: TimelineMonth }
  | {
      readonly kind: typeof ScreenKind.Months
      readonly year: TimelineYear
      readonly intent: Intent
    }
  | { readonly kind: typeof ScreenKind.Present }
  | { readonly kind: typeof ScreenKind.Presentation; readonly source: PresentationSource }
  | { readonly kind: typeof ScreenKind.Settings }
  | { readonly kind: typeof ScreenKind.Years; readonly intent: Intent }
  | { readonly kind: typeof ScreenKind.Book; readonly source: BookSource }

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

// What the start screen opens: every photo, the albums, the timeline by year, the choices of a
// presentation and its settings.
export const HOME_ENTRIES: readonly Screen[] = [
  { kind: ScreenKind.AllPhotos },
  { kind: ScreenKind.Albums, intent: Intent.Browse },
  { kind: ScreenKind.Years, intent: Intent.Browse },
  { kind: ScreenKind.Present },
  { kind: ScreenKind.Settings },
]

export const PresentChoice = {
  Library: 'library',
  Album: 'album',
  Year: 'year',
  Month: 'month',
  BookAlbum: 'book-album',
  BookMonth: 'book-month',
} as const

export type PresentChoice = (typeof PresentChoice)[keyof typeof PresentChoice]

export interface PresentOption {
  readonly choice: PresentChoice
  readonly screen: Screen
}

// The choices of a presentation: the whole library starts at once; an album, a year or a month is
// chosen on the screens of the gallery first, and so is the album or the month seen as a book.
export const PRESENT_OPTIONS: readonly PresentOption[] = [
  {
    choice: PresentChoice.Library,
    screen: { kind: ScreenKind.Presentation, source: LIBRARY_SOURCE },
  },
  { choice: PresentChoice.Album, screen: { kind: ScreenKind.Albums, intent: Intent.PresentAlbum } },
  { choice: PresentChoice.Year, screen: { kind: ScreenKind.Years, intent: Intent.PresentYear } },
  { choice: PresentChoice.Month, screen: { kind: ScreenKind.Years, intent: Intent.PresentMonth } },
  {
    choice: PresentChoice.BookAlbum,
    screen: { kind: ScreenKind.Albums, intent: Intent.BookAlbum },
  },
  {
    choice: PresentChoice.BookMonth,
    screen: { kind: ScreenKind.Years, intent: Intent.BookMonth },
  },
]

// The intents that go on from a year to choose one of its months.
const MONTH_INTENTS: ReadonlySet<Intent> = new Set([Intent.PresentMonth, Intent.BookMonth])

// Enter on an album: its photos, its presentation, or the album as a book.
export function albumScreen(album: Album, intent: Intent): Screen {
  switch (intent) {
    case Intent.PresentAlbum:
      return { kind: ScreenKind.Presentation, source: { kind: SourceKind.Album, album } }
    case Intent.BookAlbum:
      return bookScreen({ kind: SourceKind.Album, album })
    default:
      return { kind: ScreenKind.Album, album }
  }
}

// Enter on a year: its presentation, or its months, to browse or to choose one to present.
export function yearScreen(year: TimelineYear, intent: Intent): Screen {
  if (intent === Intent.PresentYear) {
    return { kind: ScreenKind.Presentation, source: { kind: SourceKind.Year, year } }
  }
  const monthsIntent = MONTH_INTENTS.has(intent) ? intent : Intent.Browse
  return { kind: ScreenKind.Months, year, intent: monthsIntent }
}

// Enter on a month: its photos, its presentation, or the month as a book.
export function monthScreen(month: TimelineMonth, intent: Intent): Screen {
  switch (intent) {
    case Intent.PresentMonth:
      return { kind: ScreenKind.Presentation, source: { kind: SourceKind.Month, month } }
    case Intent.BookMonth:
      return bookScreen({ kind: SourceKind.Month, month })
    default:
      return { kind: ScreenKind.Month, month }
  }
}

export function bookScreen(source: BookSource): Screen {
  return { kind: ScreenKind.Book, source }
}

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
