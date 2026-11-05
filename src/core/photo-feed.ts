import { sortPhotos } from './gallery.ts'
import { type LoadFailure, type LoadOutcome, LoadStatus } from './loading.ts'
import { type Photo, PhotoOrder, type TimelineMonth } from './photo-library.ts'

// Every photo of the library, the most recent first, read a month at a time from the most recent
// month, as the focus comes near the end of what is read: a TV never asks for the whole library.
export interface FeedMonth {
  readonly month: TimelineMonth
  // The most recent first.
  readonly photos: readonly Photo[]
}

export interface PhotoFeed {
  // Every month of the timeline, the most recent first.
  readonly months: readonly TimelineMonth[]
  // The first of them, read, in the same order.
  readonly read: readonly FeedMonth[]
  // How many photos the months read hold.
  readonly photoCount: number
  // Why the last month asked for did not come; nothing more is asked for until a retry.
  readonly failure: LoadFailure | undefined
}

// The next month is read once fewer photos than this are left after the focus: more than a screen
// of the grid, and far ahead of the viewer.
export const READ_AHEAD_PHOTOS = 36
const MONTHS_IN_A_YEAR = 12

export function startFeed(months: readonly TimelineMonth[]): PhotoFeed {
  const newestFirst = [...months]
  newestFirst.sort(newerFirst)
  return { months: newestFirst, read: [], photoCount: 0, failure: undefined }
}

// The month to read now that the focus is on this photo: always the next one, once few photos lie
// ahead; none after a failure or once every month is read. Asked again while the month is on its
// way, it names the same month: the caller asks the library once.
export function monthToRead(feed: PhotoFeed, focus: number): TimelineMonth | undefined {
  if (feed.failure !== undefined || feed.photoCount - focus > READ_AHEAD_PHOTOS) {
    return undefined
  }
  return nextMonth(feed)
}

// What came of a month: its photos follow those read, or the failure stops the reads. An answer for
// any other month than the next one (a month already read) changes nothing.
export function settleMonth(
  feed: PhotoFeed,
  month: TimelineMonth,
  outcome: LoadOutcome<readonly Photo[]>,
): PhotoFeed {
  if (nextMonth(feed)?.key !== month.key) {
    return feed
  }
  if (outcome.status === LoadStatus.Failed) {
    return { ...feed, failure: outcome.failure }
  }
  const photos = sortPhotos(outcome.value, PhotoOrder.NewestFirst)
  return {
    ...feed,
    read: [...feed.read, { month, photos }],
    photoCount: feed.photoCount + photos.length,
  }
}

export function retryFeed(feed: PhotoFeed): PhotoFeed {
  return feed.failure === undefined ? feed : { ...feed, failure: undefined }
}

export function isFeedComplete(feed: PhotoFeed): boolean {
  return feed.read.length === feed.months.length
}

// Every photo of the months read, in the order of the feed.
export function feedPhotos(read: readonly FeedMonth[]): readonly Photo[] {
  return ([] as Photo[]).concat(...read.map((month) => month.photos))
}

function nextMonth(feed: PhotoFeed): TimelineMonth | undefined {
  return feed.months[feed.read.length]
}

// Chromium 68 does not sort stably: the key decides between two names of the same month.
function newerFirst(first: TimelineMonth, second: TimelineMonth): number {
  const byDate = monthNumber(second) - monthNumber(first)
  if (byDate !== 0) {
    return byDate
  }
  return first.key < second.key ? -1 : Number(first.key > second.key)
}

function monthNumber(month: TimelineMonth): number {
  return month.year * MONTHS_IN_A_YEAR + month.month
}
