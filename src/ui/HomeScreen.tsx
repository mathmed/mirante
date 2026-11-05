import type { JSX } from 'preact'
import { useState } from 'preact/hooks'

import { HOME_ENTRIES } from '../core/navigation.ts'
import type { ServerInfo } from '../core/photo-library.ts'
import { Backdrop } from './Backdrop.tsx'
import { Grid } from './Grid.tsx'
import { HomeIcon } from './HomeIcon.tsx'
import { Logo, LogoLayout } from './Logo.tsx'
import { homeTitle, MESSAGES, serverText } from './messages.ts'
import type { ScreenProps } from './screen-props.ts'

const SHAPE = { columns: 4, visibleRows: 1 }

export interface HomeScreenProps extends ScreenProps {
  readonly server: ServerInfo
  // A photo of the library behind the screen; none while it loads, or when there is none.
  readonly backdropUrl: string | undefined
}

// The ways into the library, its albums and its timeline, its presentations and their settings,
// under the logo.
export function HomeScreen(props: HomeScreenProps): JSX.Element {
  const { server, backdropUrl } = props
  return (
    <main class="screen home">
      {backdropUrl !== undefined && <Backdrop key={backdropUrl} url={backdropUrl} />}
      <header class="home-header">
        <h1 class="home-logo">
          <Logo layout={LogoLayout.Inline} />
        </h1>
        <p class="home-tagline">{MESSAGES.tagline}</p>
      </header>
      <HomeGrid {...props} />
      <p class="footnote">{serverText(server)}</p>
    </main>
  )
}

function HomeGrid({ keys, position, open, back }: HomeScreenProps): JSX.Element {
  const [current, setCurrent] = useState(position)
  return (
    <Grid
      label={MESSAGES.appName}
      variant="home"
      items={HOME_ENTRIES}
      shape={SHAPE}
      position={current}
      keys={keys}
      keyOf={(entry) => entry.kind}
      renderTile={(entry) => (
        <>
          <HomeIcon kind={entry.kind} />
          <span class="tile-title">{homeTitle(entry.kind)}</span>
        </>
      )}
      onMove={setCurrent}
      onOpen={(entry, from) => {
        open(from, entry)
      }}
      onBack={back}
    />
  )
}
