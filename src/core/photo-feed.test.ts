import { describe, expect, it } from 'vitest'

import { photos } from '../../test/library-stub.ts'
import { LoadFailure, type LoadOutcome, LoadStatus } from './loading.ts'
import {
  feedPhotos,
  isFeedComplete,
  monthToRead,
  type PhotoFeed,
  READ_AHEAD_PHOTOS,
  retryFeed,
  settleMonth,
  startFeed,
} from './photo-feed.ts'
import type { Photo, TimelineMonth } from './photo-library.ts'

function month(
  year: number,
  number: number,
  key = `${String(year)}-${String(number)}`,
): TimelineMonth {
  return { key, year, month: number, photoCount: 1 }
}

const MARCH = month(2024, 3)
const APRIL = month(2024, 4)
const DECEMBER = month(2023, 12)

function loaded(value: readonly Photo[]): LoadOutcome<readonly Photo[]> {
  return { status: LoadStatus.Loaded, value }
}

// The feed once these months were read, in this order.
function readThrough(
  feed: PhotoFeed,
  months: readonly (readonly [TimelineMonth, readonly Photo[]])[],
): PhotoFeed {
  return months.reduce(
    (previous, [readMonth, monthPhotos]) => settleMonth(previous, readMonth, loaded(monthPhotos)),
    feed,
  )
}

describe('startFeed', () => {
  it('should order the months from the most recent, whatever order they come in', () => {
    const sut = startFeed([MARCH, DECEMBER, APRIL, month(2025, 1)])

    expect(sut.months.map((each) => each.key)).toStrictEqual([
      '2025-1',
      '2024-4',
      '2024-3',
      '2023-12',
    ])
    expect(sut).toMatchObject({ read: [], photoCount: 0, failure: undefined })
  })

  it('should order two names of the same month by their keys', () => {
    const later = month(2024, 3, 'b')
    const earlier = month(2024, 3, 'a')

    expect(startFeed([later, earlier, later]).months).toStrictEqual([earlier, later, later])
    expect(startFeed([earlier, later]).months).toStrictEqual([earlier, later])
  })

  it('should order three names of the same month by their keys, whatever order they come in', () => {
    expect(
      startFeed(['c', 'a', 'b'].map((key) => month(2024, 3, key))).months.map((each) => each.key),
    ).toStrictEqual(['a', 'b', 'c'])
  })

  it('should keep the order of two months of the same name', () => {
    const counted = { ...MARCH, photoCount: 2 }

    expect(startFeed([MARCH, counted]).months).toStrictEqual([MARCH, counted])
  })
})

describe('monthToRead', () => {
  it('should read the most recent month first', () => {
    expect(monthToRead(startFeed([MARCH, APRIL]), 0)).toBe(APRIL)
  })

  it('should read the next month only once few photos are left after the focus', () => {
    const sut = readThrough(startFeed([MARCH, APRIL]), [
      [APRIL, photos('april', READ_AHEAD_PHOTOS + 2)],
    ])

    expect(monthToRead(sut, 0)).toBeUndefined()
    expect(monthToRead(sut, 1)).toBeUndefined()
    expect(monthToRead(sut, 2)).toBe(MARCH)
  })

  it('should read nothing more once every month is read', () => {
    const sut = readThrough(startFeed([MARCH]), [[MARCH, photos('march', 1)]])

    expect(monthToRead(sut, 0)).toBeUndefined()
  })

  it('should name the same month until it comes', () => {
    const sut = startFeed([MARCH, APRIL])

    expect(monthToRead(sut, 0)).toBe(APRIL)
    expect(monthToRead(sut, 0)).toBe(APRIL)
  })

  it('should not ask again after a failure, until a retry', () => {
    const failed = settleMonth(startFeed([MARCH]), MARCH, {
      status: LoadStatus.Failed,
      failure: LoadFailure.Unreachable,
    })

    expect(failed).toMatchObject({ failure: LoadFailure.Unreachable, read: [], photoCount: 0 })
    expect(monthToRead(failed, 0)).toBeUndefined()
    expect(monthToRead(retryFeed(failed), 0)).toBe(MARCH)
  })
})

describe('settleMonth', () => {
  it('should add the photos of the month, the most recent first, after those read', () => {
    const april = photos('april', 2, { year: 2024, month: 4 })
    const march = photos('march', 3)

    const sut = readThrough(startFeed([MARCH, APRIL]), [
      [APRIL, april],
      [MARCH, march],
    ])

    expect(feedPhotos(sut.read).map((photo) => photo.id)).toStrictEqual([
      'april-2',
      'april-1',
      'march-3',
      'march-2',
      'march-1',
    ])
    expect(sut.read.map((each) => each.month)).toStrictEqual([APRIL, MARCH])
    expect(sut.photoCount).toBe(5)
    expect(sut.failure).toBeUndefined()
  })

  it('should take a month without photos and go on to the next one', () => {
    const sut = readThrough(startFeed([MARCH, APRIL]), [[APRIL, []]])

    expect(sut.photoCount).toBe(0)
    expect(monthToRead(sut, 0)).toBe(MARCH)
  })

  it('should drop the answer for a month already read, or for another one', () => {
    const feed = startFeed([MARCH, APRIL])
    const april = readThrough(feed, [[APRIL, photos('april', 1)]])

    expect(settleMonth(april, APRIL, loaded(photos('april', 1)))).toBe(april)
    expect(settleMonth(feed, MARCH, loaded(photos('march', 1)))).toBe(feed)
  })
})

describe('retryFeed', () => {
  it('should change nothing in a feed that did not fail', () => {
    const feed = startFeed([MARCH])

    expect(retryFeed(feed)).toBe(feed)
  })
})

describe('isFeedComplete', () => {
  it('should be complete once every month is read', () => {
    const feed = startFeed([MARCH, APRIL])
    const april = readThrough(feed, [[APRIL, photos('april', 1)]])

    expect(isFeedComplete(feed)).toBe(false)
    expect(isFeedComplete(april)).toBe(false)
    expect(isFeedComplete(readThrough(april, [[MARCH, []]]))).toBe(true)
    expect(isFeedComplete(startFeed([]))).toBe(true)
  })
})
