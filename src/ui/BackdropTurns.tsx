import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'

import { Backdrop, type BackdropPhoto } from './Backdrop.tsx'

// How long each photo stays behind the start screen when there are several.
export const BACKDROP_TURN_MS = 15_000

export interface BackdropTurnsProps {
  readonly photos: readonly BackdropPhoto[]
}

// The photos behind the start screen, in turns: each new one fades in over the one before, which
// stays below it until the next turn; never more than two in the page, for the TV's memory.
export function BackdropTurns({ photos }: BackdropTurnsProps): JSX.Element {
  const count = photos.length
  const [turn, setTurn] = useState(0)
  useEffect(() => {
    if (count <= 1) {
      return undefined
    }
    const timer = setInterval(() => {
      setTurn((previous) => previous + 1)
    }, BACKDROP_TURN_MS)
    return () => {
      clearInterval(timer)
    }
  }, [count])
  const shown = turn === 0 ? [turn] : [turn - 1, turn]
  return (
    <>
      {shown.map((each) =>
        photos
          .slice(each % count, (each % count) + 1)
          .map((photo) => <Backdrop key={each} photo={photo} />),
      )}
    </>
  )
}
