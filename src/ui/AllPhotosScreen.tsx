import type { JSX } from 'preact'
import { useCallback, useMemo, useState } from 'preact/hooks'

import { feedLayout, type FeedShape } from '../core/feed-layout.ts'
import { type GridPosition, START_POSITION } from '../core/grid.ts'
import { feedPhotos, isFeedComplete, type PhotoFeed } from '../core/photo-feed.ts'
import type { TimelineMonth } from '../core/photo-library.ts'
import { slideOf } from '../core/presentation.ts'
import { Feed } from './Feed.tsx'
import { Frame } from './Frame.tsx'
import { Loaded } from './Loaded.tsx'
import { MESSAGES } from './messages.ts'
import type { ScreenProps } from './screen-props.ts'
import { Empty, Failure, Waiting } from './Status.tsx'
import { useLibraryLoad } from './use-load.ts'
import { usePhotoFeed } from './use-photo-feed.ts'
import type { Rounds } from './use-presentation.ts'
import { Viewer } from './Viewer.tsx'

// Six photos a row, about 3:2; the screen holds three rows of photos and the headings of two months,
// each a third of a row high.
const SHAPE: FeedShape = { columns: 6, screenHeight: 11, rowHeight: 3, headingHeight: 1 }

// Every photo of the library, the most recent first, under the heading of each month, as the
// "Recents" of a phone: the months are read as the focus goes down.
export function AllPhotosScreen(props: ScreenProps): JSX.Element {
  const { library, keys, reportError, back } = props
  const task = useCallback(async () => library.listTimelineMonths(), [library])
  const load = useLibraryLoad(task, reportError)
  return (
    <Frame title={MESSAGES.allPhotosTitle}>
      <Loaded
        load={load}
        emptyText={MESSAGES.emptyTimeline}
        keys={keys}
        onBack={back}
        render={(months) => <FeedBrowser {...props} months={months} />}
      />
    </Frame>
  )
}

interface FeedBrowserProps extends ScreenProps {
  readonly months: readonly TimelineMonth[]
}

// The photo open in the viewer, and whether it opened to present from there.
interface Viewing {
  readonly index: number
  readonly shouldPlay: boolean
}

// The grid leaves the screen while the viewer is open, its thumbnails unloaded; Back brings it back
// with the focus on the photo the viewer showed last. Both read the months ahead of their focus.
function FeedBrowser(props: FeedBrowserProps): JSX.Element {
  const { library, months, reportError, keys, back } = props
  const [reach, setReach] = useState(0)
  const { feed, retry } = usePhotoFeed({ library, months, reach, reportError })
  const browsing = useBrowsing(setReach, retry)
  if (feed.photoCount === 0) {
    return <FeedStatus feed={feed} retry={retry} keys={keys} back={back} />
  }
  if (browsing.viewing !== undefined) {
    return <FeedViewer {...props} feed={feed} viewing={browsing.viewing} browsing={browsing} />
  }
  return <FeedGrid {...props} feed={feed} browsing={browsing} />
}

interface Browsing {
  readonly position: GridPosition
  readonly viewing: Viewing | undefined
  readonly move: (position: GridPosition) => void
  // The viewer opens on the photo, to show it or to present from it.
  readonly open: (index: number, from: GridPosition, shouldPlay: boolean) => void
  // The viewer shows a photo: the months are read ahead of it.
  readonly show: (index: number) => void
  readonly close: (index: number) => void
}

// Each move reads ahead of the focus, and tries again a month that failed.
function useBrowsing(setReach: (index: number) => void, retry: () => void): Browsing {
  const [position, setPosition] = useState<GridPosition>(START_POSITION)
  const [viewing, setViewing] = useState<Viewing | undefined>(undefined)
  const show = useCallback(
    (index: number) => {
      setReach(index)
      retry()
    },
    [setReach, retry],
  )
  const move = useCallback(
    (moved: GridPosition) => {
      setPosition(moved)
      show(moved.focus)
    },
    [show],
  )
  const open = useCallback((index: number, from: GridPosition, shouldPlay: boolean) => {
    setPosition(from)
    setViewing({ index, shouldPlay })
  }, [])
  const close = useCallback((index: number) => {
    setPosition((previous) => ({ focus: index, topRow: previous.topRow }))
    setViewing(undefined)
  }, [])
  return { position, viewing, move, show, open, close }
}

interface FeedStatusProps {
  readonly feed: PhotoFeed
  readonly retry: () => void
  readonly keys: ScreenProps['keys']
  readonly back: () => void
}

// Before the first photo: the first month that fails, a timeline of videos only, or the wait.
function FeedStatus({ feed, retry, keys, back }: FeedStatusProps): JSX.Element {
  if (feed.failure !== undefined) {
    return <Failure failure={feed.failure} keys={keys} onRetry={retry} onBack={back} />
  }
  if (isFeedComplete(feed)) {
    return <Empty text={MESSAGES.emptyTimeline} keys={keys} onBack={back} />
  }
  return <Waiting text={MESSAGES.loading} keys={keys} onBack={back} />
}

interface FeedGridProps extends FeedBrowserProps {
  readonly feed: PhotoFeed
  readonly browsing: Browsing
}

function FeedGrid({ feed, browsing, library, keys, back }: FeedGridProps): JSX.Element {
  const layout = useMemo(() => feedLayout(feed.read, SHAPE), [feed.read])
  return (
    <>
      <Feed
        layout={layout}
        position={browsing.position}
        library={library}
        keys={keys}
        onMove={browsing.move}
        onOpen={(index, from) => {
          browsing.open(index, from, false)
        }}
        onPresent={(index, from) => {
          browsing.open(index, from, true)
        }}
        onBack={back}
      />
      <p class="feed-keys">
        {feed.failure === undefined ? MESSAGES.allPhotosKeys : MESSAGES.morePhotosFailed}
      </p>
    </>
  )
}

interface FeedViewerProps extends FeedGridProps {
  readonly viewing: Viewing
}

// The viewer goes through every photo in the order of the grid, across the months: it waits on the
// last photo read while the next month comes, and goes around again once the library is read.
function FeedViewer(props: FeedViewerProps): JSX.Element {
  const { feed, viewing, browsing } = props
  const { read } = feed
  const slides = useMemo(() => feedPhotos(read).map(slideOf), [read])
  const isGrowing = !isFeedComplete(feed)
  const rounds: Rounds = useMemo(
    () => ({
      after: ({ slides: round }) => round,
      onStart: () => undefined,
      isGrowing,
      onShow: browsing.show,
    }),
    [isGrowing, browsing.show],
  )
  return (
    <Viewer
      {...props}
      slides={slides}
      start={viewing.index}
      shouldPlay={viewing.shouldPlay}
      rounds={rounds}
      onClose={browsing.close}
    />
  )
}
