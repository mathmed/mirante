import {
  AssetMediaSize,
  AssetTypeEnum,
  AssetVisibility,
  getAllAlbums,
  getAssetInfo,
  getAssetThumbnailPath,
  getServerVersion,
  getTimeBucket,
  getTimeBuckets,
  searchAssets,
  searchRandom,
  type ServerVersionResponseDto,
  validateAccessToken,
} from '@immich/sdk'

import {
  type Album,
  type DateSearch,
  ImageSize,
  LibraryFailure,
  type Photo,
  type PhotoLibrary,
  PhotoLibraryError,
  type ServerInfo,
  type TimelineMonth,
} from '../core/photo-library.ts'
import { serverAddress } from '../core/runtime-config.ts'
import { albumsOf, captionOf, drawnPhotosOf, monthsOf, photosOf } from './immich-assets.ts'
import {
  apiUrl,
  type ImmichLibraryOptions,
  request,
  type RequestOptions,
} from './immich-request.ts'
import { foundPhotosOf, metadataSearchOf } from './immich-search.ts'

export type { ImmichLibraryOptions } from './immich-request.ts'

const MEDIA_SIZES: ReadonlyMap<ImageSize, AssetMediaSize> = new Map([
  [ImageSize.Thumbnail, AssetMediaSize.Thumbnail],
  [ImageSize.Preview, AssetMediaSize.Preview],
])

// Read only: the app never writes to Immich. Each call gets the address and the key of the
// configuration instead of the SDK's global defaults.
export function createImmichLibrary(options: ImmichLibraryOptions): PhotoLibrary {
  return {
    describeServer: async () => describeServer(options),
    listAlbums: async () =>
      albumsOf(await request(options, async (call) => getAllAlbums({}, call))),
    listAlbumPhotos: async (album) => listAlbumPhotos(options, album),
    listTimelineMonths: async () => monthsOf(await request(options, timelineBuckets)),
    listMonthPhotos: async (month) => listMonthPhotos(options, month),
    listRandomPhotos: async (count) => drawnPhotosOf(await request(options, randomDraw(count))),
    listPhotosTaken: async (search) => listPhotosTaken(options, search),
    readCaption: async (photoId) =>
      captionOf(await request(options, async (call) => getAssetInfo({ id: photoId }, call))),
    imageUrl: (photoId, size) => imageUrl(options, photoId, size),
  }
}

async function describeServer(options: ImmichLibraryOptions): Promise<ServerInfo> {
  const version = await request(options, getServerVersion)
  // The version is public: only an authenticated call proves the key. Validating a token changes
  // nothing on the server and needs no permission, so a read-only key passes.
  await request(options, validateAccessToken)
  return { address: serverAddress(options.config), version: formatVersion(version) }
}

// Immich lists the photos of an album month by month, like its timeline: first the months, then
// each month's photos.
async function listAlbumPhotos(
  options: ImmichLibraryOptions,
  album: Album,
): Promise<readonly Photo[]> {
  const albumId = album.id
  const buckets = await request(options, async (call) => getTimeBuckets({ albumId }, call))
  const months = await Promise.all(
    buckets.map(async ({ timeBucket }) =>
      request(options, async (call) => getTimeBucket({ albumId, timeBucket }, call)),
    ),
  )
  return ([] as Photo[]).concat(...months.map(photosOf))
}

async function listMonthPhotos(
  options: ImmichLibraryOptions,
  month: TimelineMonth,
): Promise<readonly Photo[]> {
  const bucket = await request(options, async (call) =>
    getTimeBucket({ timeBucket: month.key, visibility: AssetVisibility.Timeline }, call),
  )
  return photosOf(bucket)
}

async function listPhotosTaken(
  options: ImmichLibraryOptions,
  search: DateSearch,
): Promise<readonly Photo[]> {
  const metadataSearchDto = metadataSearchOf(search)
  const answer = await request(options, async (call) => searchAssets({ metadataSearchDto }, call))
  return foundPhotosOf(answer, search)
}

// The timeline of the library, without the archived and hidden photos, as Immich shows it.
async function timelineBuckets(call: RequestOptions): ReturnType<typeof getTimeBuckets> {
  return getTimeBuckets({ visibility: AssetVisibility.Timeline }, call)
}

// A search that reads (POST only carries its filters): photos of the timeline, as Immich shows it,
// drawn at random, without their EXIF data, which the TV does not need.
function randomDraw(count: number): (call: RequestOptions) => ReturnType<typeof searchRandom> {
  const randomSearchDto = {
    size: count,
    type: AssetTypeEnum.Image,
    visibility: AssetVisibility.Timeline,
    withExif: false,
  }
  return async (call) => searchRandom({ randomSearchDto }, call)
}

// <img> loads it from the same address as the API, without the key in the address: the proxy in
// front of Immich sends it.
function imageUrl(options: ImmichLibraryOptions, photoId: string, size: ImageSize): string {
  const path = getAssetThumbnailPath(encodeURIComponent(photoId))
  return `${apiUrl(options.config)}${path}?size=${String(MEDIA_SIZES.get(size))}`
}

function formatVersion(version: ServerVersionResponseDto): string {
  const parts = [version.major, version.minor, version.patch]
  if (!parts.every((part) => Number.isInteger(part))) {
    throw new PhotoLibraryError(LibraryFailure.NotImmich, 'Unexpected version format')
  }
  return parts.join('.')
}
