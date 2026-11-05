import { useCallback, useEffect, useState } from 'preact/hooks'

import { LOADING, type LoadState, runLoad } from '../core/loading.ts'

export interface Load<S> {
  readonly state: S
  readonly retry: () => void
}

// Runs the task once on mount and again on each retry. An outcome that arrives after the screen
// moved on (unmounted, or a newer attempt started) is dropped.
export function useLoad<S>(run: () => Promise<S>, loading: S): Load<S> {
  const [state, setState] = useState<S>(loading)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let isCurrent = true
    void run().then((outcome) => {
      if (isCurrent) {
        setState(outcome)
      }
    })
    return () => {
      isCurrent = false
    }
  }, [run, attempt])

  const retry = useCallback(() => {
    setState(loading)
    setAttempt((previous) => previous + 1)
  }, [loading])

  return { state, retry }
}

// A read of the photo library: its failure becomes a state the screen explains, and goes to the log.
export function useLibraryLoad<T>(
  task: () => Promise<T>,
  reportError: (error: unknown) => void,
): Load<LoadState<T>> {
  const run = useCallback(async () => runLoad(task, reportError), [task, reportError])
  return useLoad<LoadState<T>>(run, LOADING)
}
