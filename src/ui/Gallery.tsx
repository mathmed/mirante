import type { JSX } from 'preact'
import { useCallback, useState } from 'preact/hooks'

import type { GridPosition } from '../core/grid.ts'
import {
  depthOf,
  goBack,
  openScreen,
  type Screen,
  ScreenKind,
  startNavigation,
} from '../core/navigation.ts'
import type { KeySource } from '../core/remote-key.ts'
import type { Session } from '../core/startup.ts'
import { AlbumsScreen } from './AlbumsScreen.tsx'
import { HomeScreen } from './HomeScreen.tsx'
import { AlbumScreen, MonthScreen } from './PhotosScreen.tsx'
import type { ScreenProps } from './screen-props.ts'
import { MonthsScreen, YearsScreen } from './TimelineScreens.tsx'

export interface GalleryProps {
  readonly session: Session
  readonly keys: KeySource
  readonly reportError: (error: unknown) => void
}

// The screens of the library, one on top of the other: Enter opens the next, Back returns to the
// one below with the focus where it was.
export function Gallery({ session, keys, reportError }: GalleryProps): JSX.Element {
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
  const props: ScreenProps = {
    library: session.library,
    keys,
    reportError,
    position: navigation.current.position,
    open,
    back,
  }
  return (
    <ScreenView key={depth} screen={navigation.current.screen} session={session} props={props} />
  )
}

interface ScreenViewProps {
  readonly screen: Screen
  readonly session: Session
  readonly props: ScreenProps
}

function ScreenView({ screen, session, props }: ScreenViewProps): JSX.Element {
  switch (screen.kind) {
    case ScreenKind.Home:
      return <HomeScreen {...props} server={session.server} />
    case ScreenKind.Albums:
      return <AlbumsScreen {...props} />
    case ScreenKind.Years:
      return <YearsScreen {...props} />
    case ScreenKind.Months:
      return <MonthsScreen {...props} year={screen.year} />
    default:
      return <PhotoScreenView screen={screen} session={session} props={props} />
  }
}

interface PhotoScreenViewProps extends ScreenViewProps {
  readonly screen: Extract<Screen, { readonly kind: 'album' | 'month' }>
}

function PhotoScreenView({ screen, session, props }: PhotoScreenViewProps): JSX.Element {
  const { slideshowSeconds } = session
  return screen.kind === ScreenKind.Album ? (
    <AlbumScreen {...props} album={screen.album} slideshowSeconds={slideshowSeconds} />
  ) : (
    <MonthScreen {...props} month={screen.month} slideshowSeconds={slideshowSeconds} />
  )
}
