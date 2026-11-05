import type { JSX } from 'preact'
import { useCallback, useState } from 'preact/hooks'

import { loadTimeline, type TimelineYear } from '../core/gallery.ts'
import { ScreenKind } from '../core/navigation.ts'
import { Frame } from './Frame.tsx'
import { Grid } from './Grid.tsx'
import { Loaded } from './Loaded.tsx'
import { MESSAGES, monthCountText, monthName } from './messages.ts'
import type { ScreenProps } from './screen-props.ts'
import { useLibraryLoad } from './use-load.ts'

const YEAR_SHAPE = { columns: 4, visibleRows: 2 }
const MONTH_SHAPE = { columns: 4, visibleRows: 3 }

// The timeline, a year at a time: the years that have photos, the most recent first.
export function YearsScreen(props: ScreenProps): JSX.Element {
  const { library, keys, reportError, back } = props
  const task = useCallback(async () => loadTimeline(library), [library])
  const load = useLibraryLoad(task, reportError)
  return (
    <Frame title={MESSAGES.timeline}>
      <Loaded
        load={load}
        emptyText={MESSAGES.emptyTimeline}
        keys={keys}
        onBack={back}
        render={(years) => <YearGrid years={years} {...props} />}
      />
    </Frame>
  )
}

interface YearGridProps extends ScreenProps {
  readonly years: readonly TimelineYear[]
}

function YearGrid({ years, keys, position, open, back }: YearGridProps): JSX.Element {
  const [current, setCurrent] = useState(position)
  return (
    <Grid
      label={MESSAGES.timeline}
      variant="years"
      items={years}
      shape={YEAR_SHAPE}
      position={current}
      keys={keys}
      keyOf={(year) => String(year.year)}
      renderTile={(year) => (
        <>
          <span class="tile-title">{year.year}</span>
          <span class="tile-detail">{monthCountText(year.months.length)}</span>
        </>
      )}
      onMove={setCurrent}
      onOpen={(year, from) => {
        open(from, { kind: ScreenKind.Months, year })
      }}
      onBack={back}
    />
  )
}

export interface MonthsScreenProps extends ScreenProps {
  readonly year: TimelineYear
}

// The months of a year that have photos, in the order of the calendar.
export function MonthsScreen({ year, keys, position, open, back }: MonthsScreenProps): JSX.Element {
  const [current, setCurrent] = useState(position)
  const title = String(year.year)
  return (
    <Frame title={title}>
      <Grid
        label={title}
        variant="months"
        items={year.months}
        shape={MONTH_SHAPE}
        position={current}
        keys={keys}
        keyOf={(month) => month.key}
        renderTile={(month) => <span class="tile-title">{monthName(month.month)}</span>}
        onMove={setCurrent}
        onOpen={(month, from) => {
          open(from, { kind: ScreenKind.Month, month })
        }}
        onBack={back}
      />
    </Frame>
  )
}
