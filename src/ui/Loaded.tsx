import type { JSX } from 'preact'

import { type LoadState, LoadStatus } from '../core/loading.ts'
import type { KeySource } from '../core/remote-key.ts'
import { MESSAGES, type PanelText } from './messages.ts'
import { Empty, Failure, Waiting } from './Status.tsx'
import type { Load } from './use-load.ts'

export interface LoadedProps<T> {
  readonly load: Load<LoadState<readonly T[]>>
  readonly emptyText: PanelText
  readonly keys: KeySource
  readonly onBack: () => void
  readonly render: (items: readonly T[]) => JSX.Element
}

// A list read from the library: while it loads, when it fails, when it is empty, and once it is there.
export function Loaded<T>({ load, emptyText, keys, onBack, render }: LoadedProps<T>): JSX.Element {
  const { state } = load
  if (state.status === LoadStatus.Loading) {
    return <Waiting text={MESSAGES.loading} keys={keys} onBack={onBack} />
  }
  if (state.status === LoadStatus.Failed) {
    return <Failure failure={state.failure} keys={keys} onRetry={load.retry} onBack={onBack} />
  }
  if (state.value.length === 0) {
    return <Empty text={emptyText} keys={keys} onBack={onBack} />
  }
  return render(state.value)
}
