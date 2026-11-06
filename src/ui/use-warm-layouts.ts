import { useEffect, useState } from 'preact/hooks'

import type { BookLayouts, PhotoPage } from '../core/book.ts'

// The miniatures of the strip and of the overview draw the pages already laid out; the others are
// laid out here, one page at a time between two frames, so that the TV never stops answering.
export function useWarmLayouts(layouts: BookLayouts, pages: readonly PhotoPage[]): void {
  const [laidOut, setLaidOut] = useState(0)
  const missing = pages.find((page) => !layouts.isLaidOut(page))
  useEffect(() => {
    if (missing === undefined) {
      return undefined
    }
    const timer = setTimeout(() => {
      layouts.layoutOf(missing)
      setLaidOut((count) => count + 1)
    }, 0)
    return () => {
      clearTimeout(timer)
    }
  }, [layouts, missing, laidOut])
}
