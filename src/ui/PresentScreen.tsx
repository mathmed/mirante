import type { JSX } from 'preact'
import { useState } from 'preact/hooks'

import { PRESENT_OPTIONS } from '../core/navigation.ts'
import { Frame } from './Frame.tsx'
import { Grid } from './Grid.tsx'
import { choiceText, MESSAGES } from './messages.ts'
import type { ScreenProps } from './screen-props.ts'

const SHAPE = { columns: 3, visibleRows: 2 }

// What to present: the whole library at once, or an album, a year or a month, chosen next; or an
// album or a month as a book.
export function PresentScreen({ keys, position, open, back }: ScreenProps): JSX.Element {
  const [current, setCurrent] = useState(position)
  return (
    <Frame title={MESSAGES.present}>
      <Grid
        label={MESSAGES.present}
        variant="choices"
        items={PRESENT_OPTIONS}
        shape={SHAPE}
        position={current}
        keys={keys}
        keyOf={(option) => option.choice}
        renderTile={(option) => {
          const text = choiceText(option.choice)
          return (
            <>
              <span class="tile-title">{text.title}</span>
              <span class="tile-detail">{text.hint}</span>
            </>
          )
        }}
        onMove={setCurrent}
        onOpen={(option, from) => {
          open(from, option.screen)
        }}
        onBack={back}
      />
    </Frame>
  )
}
