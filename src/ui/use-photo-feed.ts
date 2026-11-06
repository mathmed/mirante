import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import { runLoad } from '../core/loading.ts'
import {
  monthToRead,
  type PhotoFeed,
  retryFeed,
  settleMonth,
  startFeed,
} from '../core/photo-feed.ts'
import type { PhotoLibrary, TimelineMonth } from '../core/photo-library.ts'

export interface PhotoFeedOptions {
  readonly library: PhotoLibrary
  // Every month of the timeline.
  readonly months: readonly TimelineMonth[]
  // The photo the focus is on, in the grid or in the viewer: the months are read ahead of it.
  readonly reach: number
  readonly reportError: (error: unknown) => void
}

export interface PhotoFeedControl {
  readonly feed: PhotoFeed
  // After a failure, reads the month that failed again.
  readonly retry: () => void
}

// Reads the months of the feed one at a time, as the focus comes near the end of what is read: a
// month on its way is never asked for again. A failure goes to the log and stops the reads until a
// retry.
export function usePhotoFeed(options: PhotoFeedOptions): PhotoFeedControl {
  const { library, months, reach, reportError } = options
  const [feed, setFeed] = useState(() => startFeed(months))
  const readingRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const month = monthToRead(feed, reach)
    if (month === undefined || readingRef.current === month.key) {
      return
    }
    readingRef.current = month.key
    void runLoad(async () => library.listMonthPhotos(month), reportError).then((outcome) => {
      readingRef.current = undefined
      setFeed((previous) => settleMonth(previous, month, outcome))
    })
  }, [feed, reach, library, reportError])
  const retry = useCallback(() => {
    setFeed(retryFeed)
  }, [])
  return { feed, retry }
}
