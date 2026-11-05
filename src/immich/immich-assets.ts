import {
  type AlbumResponseDto,
  AssetOrder,
  type TimeBucketAssetResponseDto,
  type TimeBucketsResponseDto,
} from '@immich/sdk'

import { photoDateOf } from '../core/photo-date.ts'
import { type Album, type Photo, PhotoOrder, type TimelineMonth } from '../core/photo-library.ts'
import { malformed } from './immich-request.ts'

// Immich names a month of the timeline by its first day ("2024-03-01", or a full ISO timestamp).
const MONTH_OF_BUCKET = /^(\d{4})-(\d{2})/
const FIRST_MONTH = 1
const LAST_MONTH = 12

// One asset of a time bucket, read across its columns.
interface AssetRow {
  readonly id: unknown
  readonly isImage: unknown
  readonly fileCreatedAt: unknown
  readonly localOffsetHours: unknown
}

// The SDK does not check what the server sends: every answer is checked here, where it enters.
export function albumsOf(answer: readonly AlbumResponseDto[]): readonly Album[] {
  return listOf(answer, 'album list').map(albumOf)
}

export function monthsOf(answer: readonly TimeBucketsResponseDto[]): readonly TimelineMonth[] {
  return listOf(answer, 'timeline').map(monthOf)
}

// The answer comes in columns, one value per asset in each; only the photos are kept.
export function photosOf(bucket: TimeBucketAssetResponseDto): readonly Photo[] {
  return rowsOf(bucket)
    .filter((row) => row.isImage === true)
    .map(photoOf)
}

function instantOf(text: unknown, what: string): number {
  const instant = typeof text === 'string' ? Date.parse(text) : Number.NaN
  if (Number.isNaN(instant)) {
    throw malformed(what)
  }
  return instant
}

function albumOf(answer: AlbumResponseDto): Album {
  const { id, albumName, assetCount, albumThumbnailAssetId, endDate } = answer
  if (typeof id !== 'string' || typeof albumName !== 'string' || typeof assetCount !== 'number') {
    throw malformed('album')
  }
  const album: Album = {
    id,
    name: albumName,
    photoCount: assetCount,
    order: answer.order === AssetOrder.Asc ? PhotoOrder.OldestFirst : PhotoOrder.NewestFirst,
  }
  return { ...album, ...coverOf(albumThumbnailAssetId), ...lastPhotoOf(endDate) }
}

function coverOf(assetId: string | null): Pick<Album, 'coverPhotoId'> {
  return typeof assetId === 'string' ? { coverPhotoId: assetId } : {}
}

function lastPhotoOf(endDate: string | undefined): Pick<Album, 'lastPhotoAtMs'> {
  return endDate === undefined ? {} : { lastPhotoAtMs: instantOf(endDate, 'album date') }
}

function monthOf(answer: TimeBucketsResponseDto): TimelineMonth {
  const key = answer.timeBucket
  const match = typeof key === 'string' ? MONTH_OF_BUCKET.exec(key) : null
  const year = Number(match?.[1])
  const month = Number(match?.[2])
  if (!isMonth(month)) {
    throw malformed('month of the timeline')
  }
  return { key, year, month }
}

// NaN, when the bucket has no month, is not one either.
function isMonth(month: number): boolean {
  return month >= FIRST_MONTH && month <= LAST_MONTH
}

function rowsOf(bucket: TimeBucketAssetResponseDto): readonly AssetRow[] {
  const isImage = listOf(bucket.isImage, 'asset kinds').values()
  const fileCreatedAt = listOf(bucket.fileCreatedAt, 'asset dates').values()
  const localOffsetHours = listOf(bucket.localOffsetHours, 'asset offsets').values()
  return listOf(bucket.id, 'asset ids').map((id) => ({
    id,
    isImage: isImage.next().value,
    fileCreatedAt: fileCreatedAt.next().value,
    localOffsetHours: localOffsetHours.next().value,
  }))
}

function photoOf({ id, fileCreatedAt, localOffsetHours }: AssetRow): Photo {
  if (typeof id !== 'string' || typeof localOffsetHours !== 'number') {
    throw malformed('asset')
  }
  const takenAtMs = instantOf(fileCreatedAt, 'asset date')
  return { id, takenAtMs, date: photoDateOf(takenAtMs, localOffsetHours) }
}

function listOf<T>(answer: readonly T[], what: string): readonly T[] {
  const value: unknown = answer
  if (!Array.isArray(value)) {
    throw malformed(what)
  }
  return answer
}
