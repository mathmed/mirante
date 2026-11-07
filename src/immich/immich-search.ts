import {
  AssetOrder,
  AssetTypeEnum,
  AssetVisibility,
  type MetadataSearchDto,
  SearchOrderField,
  type SearchResponseDto,
} from '@immich/sdk'

import { addDays, dayNumber } from '../core/calendar.ts'
import { type DateSearch, type Photo, type PhotoDate, PhotoOrder } from '../core/photo-library.ts'
import { drawnPhotosOf } from './immich-assets.ts'
import { malformed } from './immich-request.ts'

const MS_PER_HOUR = 3_600_000
// The farthest offsets from UTC of a place on Earth: a day there starts 14 hours before it starts in
// UTC, and ends 12 hours after.
const EARLIEST_OFFSET_HOURS = 14
const LATEST_OFFSET_HOURS = 12

// A search that reads (POST only carries its filters): photos of the timeline, as Immich shows it,
// taken in the instants that may fall on those days somewhere, ordered by the time on the clock of
// the place they were taken, without their EXIF data.
export function metadataSearchOf({ from, to, order, count }: DateSearch): MetadataSearchDto {
  const direction = order === PhotoOrder.OldestFirst ? AssetOrder.Asc : AssetOrder.Desc
  return {
    takenAfter: instantText(from, -EARLIEST_OFFSET_HOURS),
    takenBefore: instantText(addDays(to, 1), LATEST_OFFSET_HOURS),
    type: AssetTypeEnum.Image,
    visibility: AssetVisibility.Timeline,
    withExif: false,
    size: count,
    orderBy: { field: SearchOrderField.LocalDateTime, direction },
  }
}

// The photos found, only those of the days searched by the date of their place.
export function foundPhotosOf(answer: SearchResponseDto, search: DateSearch): readonly Photo[] {
  const assets: unknown = answer.assets
  if (typeof assets !== 'object' || assets === null) {
    throw malformed('search')
  }
  const first = dayNumber(search.from)
  const last = dayNumber(search.to)
  return drawnPhotosOf(answer.assets.items).filter((photo) => {
    const day = dayNumber(photo.date)
    return day >= first && day <= last
  })
}

export function hasNextPage(answer: SearchResponseDto): boolean {
  return typeof answer.assets.nextPage === 'string'
}

function instantText(day: PhotoDate, shiftHours: number): string {
  const midnight = Date.UTC(day.year, day.month - 1, day.day)
  return new Date(midnight + shiftHours * MS_PER_HOUR).toISOString()
}
