import type { JSX } from 'preact'
import { useCallback, useState } from 'preact/hooks'

import { bookSeedOf, persistBookSeeds, restoreBookSeeds, withBookSeed } from '../core/book-seeds.ts'
import type { GridPosition } from '../core/grid.ts'
import {
  depthOf,
  goBack,
  type Navigation,
  openScreen,
  type Screen,
  ScreenKind,
  startNavigation,
} from '../core/navigation.ts'
import type { PhotoDate } from '../core/photo-library.ts'
import type { PresentationSettings } from '../core/presentation-settings.ts'
import type { KeySource } from '../core/remote-key.ts'
import { persistSettings, restoreSettings, type TextStorage } from '../core/settings-storage.ts'
import type { Session } from '../core/startup.ts'
import { AlbumsScreen } from './AlbumsScreen.tsx'
import { AllPhotosScreen } from './AllPhotosScreen.tsx'
import { BookScreen } from './BookScreen.tsx'
import { HomeScreen } from './HomeScreen.tsx'
import { AlbumScreen, MonthScreen } from './PhotosScreen.tsx'
import { PresentationScreen } from './PresentationScreen.tsx'
import { PresentScreen } from './PresentScreen.tsx'
import type { BookControls, PresentationControls, ScreenProps } from './screen-props.ts'
import { SettingsScreen } from './SettingsScreen.tsx'
import { MonthsScreen, YearsScreen } from './TimelineScreens.tsx'
import { useBackdrop } from './use-backdrop.ts'
import { useSummary } from './use-summary.ts'

export interface GalleryProps {
  readonly session: Session
  readonly keys: KeySource
  readonly reportError: (error: unknown) => void
  // Back on the start screen, which has no screen below it.
  readonly leave: () => void
  // Where the TV keeps its settings of the presentations.
  readonly storage: TextStorage
  // Where the TV keeps the seed of each book it reorganized.
  readonly bookStorage: TextStorage
  // A new seed for each random order.
  readonly newSeed: () => number
  // The day on the TV's clock, whose photos of past years lie behind the start screen.
  readonly today: () => PhotoDate
}

// The screens of the library, one on top of the other: Enter opens the next, Back returns to the
// one below with the focus where it was; on the start screen, Back leaves the app.
export function Gallery(props: GalleryProps): JSX.Element {
  const { session, keys, reportError, leave, today } = props
  const { navigation, depth, open, back } = useNavigation()
  const backdrop = useBackdrop(session.library, today, reportError)
  const summary = useSummary(session.library, reportError)
  const books = useBookControls(props)
  const screenProps: ScreenProps = {
    library: session.library,
    keys,
    reportError,
    position: navigation.current.position,
    open,
    back,
    presentation: usePresentationControls(props),
  }
  const screen = navigation.current.screen
  if (screen.kind === ScreenKind.Home) {
    return (
      <HomeScreen
        key={depth}
        {...screenProps}
        back={leave}
        server={session.server}
        backdrop={backdrop}
        summary={summary}
      />
    )
  }
  return <ScreenView key={depth} screen={screen} props={screenProps} books={books} />
}

// The settings of this TV over the defaults of config.json, kept on the TV at each change.
function usePresentationControls(props: GalleryProps): PresentationControls {
  const { session, storage, reportError, newSeed } = props
  const defaults = session.presentationDefaults
  const [settings, setSettings] = useState(() => restoreSettings(storage, defaults, reportError))
  const saveSettings = useCallback(
    (changed: PresentationSettings) => {
      setSettings(changed)
      persistSettings(storage, changed, reportError)
    },
    [storage, reportError],
  )
  return { settings, defaults, saveSettings, newSeed }
}

// The seed of each book: the one the TV kept, or the book's own; a new one, kept, to reorganize it.
function useBookControls(props: GalleryProps): BookControls {
  const { bookStorage, reportError, newSeed } = props
  const [seeds, setSeeds] = useState(() => restoreBookSeeds(bookStorage, reportError))
  const seedOf = useCallback((key: string) => bookSeedOf(seeds, key), [seeds])
  const reorganize = useCallback(
    (key: string) => {
      const changed = withBookSeed(seeds, key, newSeed())
      setSeeds(changed)
      persistBookSeeds(bookStorage, changed, reportError)
    },
    [seeds, bookStorage, reportError, newSeed],
  )
  return { seedOf, reorganize }
}

interface NavigationControls {
  readonly navigation: Navigation
  readonly depth: number
  readonly open: (from: GridPosition, screen: Screen) => void
  readonly back: () => void
}

// The stack of screens; a request from a screen no longer on top changes nothing.
function useNavigation(): NavigationControls {
  const [navigation, setNavigation] = useState(startNavigation)
  const depth = depthOf(navigation)
  const open = useCallback(
    (from: GridPosition, screen: Screen) => {
      setNavigation((previous) => openScreen(previous, { depth, position: from }, screen))
    },
    [depth],
  )
  const back = useCallback(() => {
    setNavigation((previous) => goBack(previous, depth))
  }, [depth])
  return { navigation, depth, open, back }
}

type DeeperScreen = Exclude<Screen, { readonly kind: typeof ScreenKind.Home }>

interface ScreenViewProps {
  readonly screen: DeeperScreen
  readonly props: ScreenProps
  readonly books: BookControls
}

// The screens of the library itself.
function ScreenView({ screen, props, books }: ScreenViewProps): JSX.Element {
  switch (screen.kind) {
    case ScreenKind.AllPhotos:
      return <AllPhotosScreen {...props} />
    case ScreenKind.Book:
      return <BookScreen {...props} source={screen.source} books={books} />
    default:
      return <ListView screen={screen} props={props} />
  }
}

interface ListViewProps {
  readonly screen: Exclude<DeeperScreen, { readonly kind: 'all-photos' | 'book' }>
  readonly props: ScreenProps
}

// The lists of the library: its albums, its years and their months.
function ListView({ screen, props }: ListViewProps): JSX.Element {
  switch (screen.kind) {
    case ScreenKind.Albums:
      return <AlbumsScreen {...props} intent={screen.intent} />
    case ScreenKind.Years:
      return <YearsScreen {...props} intent={screen.intent} />
    case ScreenKind.Months:
      return <MonthsScreen {...props} year={screen.year} intent={screen.intent} />
    default:
      return <PhotosOrPresentationView screen={screen} props={props} />
  }
}

interface PhotosOrPresentationViewProps {
  readonly screen: Exclude<
    DeeperScreen,
    { readonly kind: 'albums' | 'all-photos' | 'book' | 'months' | 'years' }
  >
  readonly props: ScreenProps
}

// The photos of an album or a month, and the presentations with their settings.
function PhotosOrPresentationView({ screen, props }: PhotosOrPresentationViewProps): JSX.Element {
  switch (screen.kind) {
    case ScreenKind.Album:
      return <AlbumScreen {...props} album={screen.album} />
    case ScreenKind.Month:
      return <MonthScreen {...props} month={screen.month} />
    case ScreenKind.Presentation:
      return <PresentationScreen {...props} source={screen.source} />
    case ScreenKind.Present:
      return <PresentScreen {...props} />
    default:
      return <SettingsScreen {...props} />
  }
}
