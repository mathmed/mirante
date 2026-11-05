import {
  AssetMediaSize,
  AssetVisibility,
  getAllAlbums,
  getAssetThumbnailPath,
  getServerVersion,
  getTimeBucket,
  getTimeBuckets,
  type ServerVersionResponseDto,
  validateAccessToken,
} from '@immich/sdk'

import {
  type Album,
  ImageSize,
  LibraryFailure,
  type Photo,
  type PhotoLibrary,
  PhotoLibraryError,
  type ServerInfo,
  type TimelineMonth,
} from '../core/photo-library.ts'
import { serverAddress } from '../core/runtime-config.ts'
import { albumsOf, monthsOf, photosOf } from './immich-assets.ts'
import {
  apiUrl,
  type ImmichLibraryOptions,
  request,
  type RequestOptions,
} from './immich-request.ts'

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

// The timeline of the library, without the archived and hidden photos, as Immich shows it.
async function timelineBuckets(call: RequestOptions): ReturnType<typeof getTimeBuckets> {
  return getTimeBuckets({ visibility: AssetVisibility.Timeline }, call)
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
