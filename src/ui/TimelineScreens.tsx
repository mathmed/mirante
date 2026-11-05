import type { JSX } from 'preact'
import { useCallback, useState } from 'preact/hooks'

import { loadTimeline, type TimelineYear } from '../core/gallery.ts'
import { type Intent, monthScreen, yearScreen } from '../core/navigation.ts'
import { Frame } from './Frame.tsx'
import { Grid } from './Grid.tsx'
import { Loaded } from './Loaded.tsx'
import { MESSAGES, monthCountText, monthName, yearsTitle } from './messages.ts'
import type { ScreenProps } from './screen-props.ts'
import { useLibraryLoad } from './use-load.ts'

const YEAR_SHAPE = { columns: 4, visibleRows: 2 }
const MONTH_SHAPE = { columns: 4, visibleRows: 3 }

export interface YearsScreenProps extends ScreenProps {
  // To browse the timeline, or to choose a year or a month to present.
  readonly intent: Intent
}

// The timeline, a year at a time: the years that have photos, the most recent first.
export function YearsScreen(props: YearsScreenProps): JSX.Element {
  const { library, keys, reportError, back } = props
  const task = useCallback(async () => loadTimeline(library), [library])
  const load = useLibraryLoad(task, reportError)
  return (
    <Frame title={yearsTitle(props.intent)}>
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

interface YearGridProps extends YearsScreenProps {
  readonly years: readonly TimelineYear[]
}

function YearGrid({ years, keys, position, open, back, intent }: YearGridProps): JSX.Element {
  const [current, setCurrent] = useState(position)
  return (
    <Grid
      label={yearsTitle(intent)}
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
        open(from, yearScreen(year, intent))
      }}
      onBack={back}
    />
  )
}

export interface MonthsScreenProps extends ScreenProps {
  readonly year: TimelineYear
  // To browse the months, or to choose one to present.
  readonly intent: Intent
}

// The months of a year that have photos, in the order of the calendar.
export function MonthsScreen(props: MonthsScreenProps): JSX.Element {
  const { year, keys, position, open, back, intent } = props
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
          open(from, monthScreen(month, intent))
        }}
        onBack={back}
      />
    </Frame>
  )
}
