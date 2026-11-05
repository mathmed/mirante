import { useCallback, useEffect, useState } from 'preact/hooks'

import { LOADING, type StartupOutcome, type StartupState } from '../core/startup.ts'

export interface Startup {
  readonly state: StartupState
  readonly retry: () => void
}

// Runs the startup once on mount and again on each retry. An outcome that arrives after the screen
// moved on (unmounted, or a newer attempt started) is dropped.
export function useStartup(start: () => Promise<StartupOutcome>): Startup {
  const [state, setState] = useState<StartupState>(LOADING)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let isCurrent = true
    void start().then((outcome) => {
      if (isCurrent) {
        setState(outcome)
      }
    })
    return () => {
      isCurrent = false
    }
  }, [start, attempt])

  const retry = useCallback(() => {
    setState(LOADING)
    setAttempt((previous) => previous + 1)
  }, [])

  return { state, retry }
}
