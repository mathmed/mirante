import type { JSX } from 'preact'
import { useState } from 'preact/hooks'

import { photoPagesOf } from '../core/book-navigation.ts'
import type { Book, BookLayouts, Spread } from '../core/book.ts'
import { type GridPosition, placeInGrid, renderedRange } from '../core/grid.ts'
import type { KeySource } from '../core/remote-key.ts'
import { spreadText } from './book-messages.ts'
import { MiniSpread } from './BookStrip.tsx'
import { Grid } from './Grid.tsx'
import { MESSAGES } from './messages.ts'
import { useWarmLayouts } from './use-warm-layouts.ts'

const SHAPE = { columns: 4, visibleRows: 3 }
// The rows the grid renders around the screen.
const BUFFER_ROWS = 1

export interface BookOverviewProps {
  readonly book: Book
  readonly layouts: BookLayouts
  readonly keys: KeySource
  // The spread on the screen, where the overview opens.
  readonly current: number
  readonly onJump: (spread: number) => void
  readonly onClose: () => void
}

// Every spread of the book at once, larger than in the strip: the arrows choose one, OK opens it,
// and Back closes the overview.
export function BookOverview(props: BookOverviewProps): JSX.Element {
  const { book, layouts, keys, onJump, onClose } = props
  const layout = { count: book.spreads.length, ...SHAPE }
  const [position, setPosition] = useState<GridPosition>(() =>
    placeInGrid({ focus: props.current, topRow: 0 }, layout),
  )
  const { start, end } = renderedRange(position, layout, BUFFER_ROWS)
  useWarmLayouts(layouts, photoPagesOf(book.spreads.slice(start, end)))
  return (
    <div class="book-overview" role="dialog" aria-label={MESSAGES.bookOverview}>
      <h2 class="book-overview-title">{MESSAGES.bookOverview}</h2>
      <Grid
        label={MESSAGES.bookOverview}
        variant="spreads"
        items={book.spreads}
        shape={SHAPE}
        position={position}
        keys={keys}
        keyOf={(spread) => spread.key}
        renderTile={(spread) => <SpreadTile spread={spread} layouts={layouts} />}
        onMove={setPosition}
        onOpen={(spread) => {
          onJump(book.spreads.indexOf(spread))
        }}
        onBack={onClose}
      />
      <p class="book-keys">{MESSAGES.bookOverviewKeys}</p>
    </div>
  )
}

function SpreadTile(props: {
  readonly spread: Spread
  readonly layouts: BookLayouts
}): JSX.Element {
  return (
    <>
      <MiniSpread {...props} />
      <span class="tile-detail">{spreadText(props.spread)}</span>
    </>
  )
}
