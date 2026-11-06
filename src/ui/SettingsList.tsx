import type { JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'

import type { ScrollThumb } from '../core/list-scroll.ts'
import {
  RESTORE_ROW,
  SETTINGS_GROUPS,
  type SettingsForm,
  type SettingsGroup,
  type SettingsRow,
} from '../core/settings-form.ts'
import { sectionTitle, settingLabel, settingValueText } from './settings-messages.ts'
import { scrollItem, scrollTitle, useListScroll } from './use-list-scroll.ts'

export interface SettingsListProps {
  readonly form: SettingsForm
}

const PERCENT = 100

// The rows of the settings under the titles of their sections. The list may be taller than the
// screen: it moves up and down with the focus (transform alone, never a native scroll), the items
// not whole in view hide, and a thin bar tells where the screen is in the list.
export function SettingsList({ form }: SettingsListProps): JSX.Element {
  const { setViewport, setList, offset, outside, thumb } = useListScroll(form.row)
  const hiddenIf = (key: string): string => (outside.has(key) ? ' is-outside' : '')
  return (
    <div class="settings-viewport" ref={setViewport}>
      <div
        class="settings-scroller"
        ref={setList}
        style={{ transform: `translateY(${String(-offset)}px)` }}
      >
        {SETTINGS_GROUPS.map((group, index) => (
          <Section
            key={group.section}
            group={group}
            first={firstRowOf(index)}
            form={form}
            hiddenIf={hiddenIf}
          />
        ))}
      </div>
      {thumb !== undefined && <Track thumb={thumb} />}
    </div>
  )
}

// Where the screen is in the list, without weight: a thin line and its brighter part.
function Track({ thumb }: { readonly thumb: ScrollThumb }): JSX.Element {
  return (
    <div class="settings-track" aria-hidden="true">
      <div
        class="settings-thumb"
        style={{
          height: `${String(thumb.size * PERCENT)}%`,
          transform: `translateY(${String(thumb.shift * PERCENT)}%)`,
        }}
      />
    </div>
  )
}

interface SectionProps {
  readonly group: SettingsGroup
  // The index of its first row among every row.
  readonly first: number
  readonly form: SettingsForm
  readonly hiddenIf: (key: string) => string
}

function Section({ group, first, form, hiddenIf }: SectionProps): JSX.Element {
  const titleKey = `section-${group.section}`
  return (
    <section class="settings-section" aria-label={sectionTitle(group.section)}>
      <h2 class={`settings-section-title${hiddenIf(titleKey)}`} {...scrollTitle(titleKey)}>
        {sectionTitle(group.section)}
      </h2>
      <ul class="settings-list">
        {group.rows.map((row, index) => (
          <SettingRow
            key={keyOf(row)}
            row={row}
            form={form}
            isFocused={first + index === form.row}
            hiddenClass={hiddenIf(keyOf(row))}
          />
        ))}
      </ul>
    </section>
  )
}

interface SettingRowProps {
  readonly row: SettingsRow
  readonly form: SettingsForm
  readonly isFocused: boolean
  readonly hiddenClass: string
}

// The focused row holds the browser's focus, so that :focus shows where the remote control is.
function SettingRow({ row, form, isFocused, hiddenClass }: SettingRowProps): JSX.Element {
  const rowRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (isFocused) {
      rowRef.current?.focus({ preventScroll: true })
    }
  }, [isFocused])
  const isRestore = row.kind === RESTORE_ROW.kind
  return (
    <li
      ref={rowRef}
      class={`${isRestore ? 'setting setting-restore' : 'setting'}${hiddenClass}`}
      tabIndex={-1}
      aria-current={isFocused}
      {...scrollItem(keyOf(row))}
    >
      <span class="setting-label">{settingLabel(row)}</span>
      {row.kind !== RESTORE_ROW.kind && (
        <span class="setting-value">{settingValueText(row, form.settings)}</span>
      )}
    </li>
  )
}

function firstRowOf(groupIndex: number): number {
  return SETTINGS_GROUPS.slice(0, groupIndex).reduce((count, { rows }) => count + rows.length, 0)
}

function keyOf(row: SettingsRow): string {
  return row.kind === RESTORE_ROW.kind ? RESTORE_ROW.kind : row.name
}
