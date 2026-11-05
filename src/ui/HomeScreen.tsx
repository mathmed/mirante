import type { JSX } from 'preact'
import { useState } from 'preact/hooks'

import { HOME_ENTRIES, type HomeEntry, ScreenKind } from '../core/navigation.ts'
import type { ServerInfo } from '../core/photo-library.ts'
import { Frame } from './Frame.tsx'
import { Grid } from './Grid.tsx'
import { MESSAGES, serverText } from './messages.ts'
import type { ScreenProps } from './screen-props.ts'

const SHAPE = { columns: 2, visibleRows: 1 }

export interface HomeScreenProps extends ScreenProps {
  readonly server: ServerInfo
}

// The two ways into the library: its albums and its timeline.
export function HomeScreen({ server, keys, position, open, back }: HomeScreenProps): JSX.Element {
  const [current, setCurrent] = useState(position)
  return (
    <Frame title={MESSAGES.appName}>
      <Grid
        label={MESSAGES.appName}
        variant="home"
        items={HOME_ENTRIES}
        shape={SHAPE}
        position={current}
        keys={keys}
        keyOf={(entry) => entry.kind}
        renderTile={(entry) => <span class="tile-title">{entryText(entry)}</span>}
        onMove={setCurrent}
        onOpen={(entry, from) => {
          open(from, entry)
        }}
        onBack={back}
      />
      <p class="footnote">{serverText(server)}</p>
    </Frame>
  )
}

function entryText(entry: HomeEntry): string {
  return entry.kind === ScreenKind.Albums ? MESSAGES.albums : MESSAGES.timeline
}
