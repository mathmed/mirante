import type { JSX } from 'preact'
import { useState } from 'preact/hooks'

import type { LibrarySummary } from '../core/library-summary.ts'
import { HOME_ENTRIES } from '../core/navigation.ts'
import type { ServerInfo } from '../core/photo-library.ts'
import type { BackdropPhoto } from './Backdrop.tsx'
import { BackdropTurns } from './BackdropTurns.tsx'
import { Grid } from './Grid.tsx'
import { HomeIcon } from './HomeIcon.tsx'
import { Logo, LogoLayout } from './Logo.tsx'
import { homeTitle, MESSAGES, serverText, summaryText } from './messages.ts'
import type { ScreenProps } from './screen-props.ts'

const SHAPE = { columns: 5, visibleRows: 1 }

export interface HomeScreenProps extends ScreenProps {
  readonly server: ServerInfo
  // The photos of the library behind the screen, in turns; none while they load, or when there are
  // none.
  readonly backdrop: readonly BackdropPhoto[]
  // How many photos the library holds, over which years; none while it loads, when it fails or
  // for an empty library.
  readonly summary: LibrarySummary | undefined
}

// The ways into the library, every photo, its albums and its timeline, its presentations and their
// settings, under the logo and what the library holds.
export function HomeScreen(props: HomeScreenProps): JSX.Element {
  const { server, backdrop, summary } = props
  return (
    <main class="screen home">
      <BackdropTurns photos={backdrop} />
      <header class="home-header">
        <h1 class="home-logo">
          <Logo layout={LogoLayout.Inline} />
        </h1>
        {summary !== undefined && <p class="home-summary">{summaryText(summary)}</p>}
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
