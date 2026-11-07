import {
  type AlbumResponseDto,
  AssetOrder,
  type AssetResponseDto,
  AssetTypeEnum,
  AssetVisibility,
  type SearchResponseDto,
  type TimeBucketAssetResponseDto,
  type TimeBucketsResponseDto,
} from '@immich/sdk'

// What a fake Immich answers about a library: its albums, the months of its timeline (or of an
// album) and their assets, with the shapes of the SDK's types. The fake server of the component
// tests (MSW) and the one of the end-to-end tests (on a real port) both answer with them.
export interface FakeAsset {
  readonly id: string
  // When it was taken, in UTC, and the offset of the place where it was taken.
  readonly takenAt: string
  readonly offsetHours: number
  readonly isImage: boolean
  readonly albumIds: readonly string[]
  // Archived assets are in their albums, never in the timeline.
  readonly isArchived?: boolean
  // The caption written for it in Immich.
  readonly description?: string
  // Its width over its height; 3:2 when left out.
  readonly ratio?: number
}

const DEFAULT_RATIO = 1.5
const HEIGHT = 1000

interface FakeAlbum {
  readonly id: string
  readonly name: string
  readonly isOldestFirst?: boolean
}

export interface FakeLibrary {
  readonly albums: readonly FakeAlbum[]
  readonly assets: readonly FakeAsset[]
}

export function albumsOf(library: FakeLibrary): AlbumResponseDto[] {
  return library.albums.map((album) => {
    const assets = library.assets.filter((asset) => asset.albumIds.includes(album.id))
    const dates = assets
      .map((asset) => asset.takenAt)
      .sort((first, second) => first.localeCompare(second))
    return {
      id: album.id,
      albumName: album.name,
      albumThumbnailAssetId: assets[0]?.id ?? null,
      albumUsers: [],
      assetCount: assets.length,
      createdAt: '2020-01-01T00:00:00.000Z',
      description: '',
      hasSharedLink: false,
      isActivityEnabled: true,
      shared: false,
      updatedAt: '2020-01-01T00:00:00.000Z',
      order: album.isOldestFirst === true ? AssetOrder.Asc : AssetOrder.Desc,
      ...(dates.length === 0 ? {} : { startDate: dates[0], endDate: dates[dates.length - 1] }),
    }
  })
}

// An album's assets when the request names one, else the timeline: everything not archived.
export function assetsAsked(library: FakeLibrary, url: URL): readonly FakeAsset[] {
  const albumId = url.searchParams.get('albumId')
  return albumId === null
    ? library.assets.filter((asset) => asset.isArchived !== true)
    : library.assets.filter((asset) => asset.albumIds.includes(albumId))
}

// Immich names each month by its first day, newest first.
export function bucketsOf(assets: readonly FakeAsset[]): TimeBucketsResponseDto[] {
  const counts = new Map<string, number>()
  for (const asset of assets) {
    const month = monthOf(asset)
    counts.set(month, (counts.get(month) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([first], [second]) => second.localeCompare(first))
    .map(([timeBucket, count]) => ({ timeBucket, count }))
}

export function bucketOf(library: FakeLibrary, url: URL): TimeBucketAssetResponseDto {
  const month = url.searchParams.get('timeBucket')
  const assets = assetsAsked(library, url).filter((asset) => monthOf(asset) === month)
  return {
    id: assets.map((asset) => asset.id),
    isImage: assets.map((asset) => asset.isImage),
    fileCreatedAt: assets.map((asset) => asset.takenAt),
    localOffsetHours: assets.map((asset) => asset.offsetHours),
    createdAt: assets.map((asset) => asset.takenAt),
    duration: assets.map((asset) => (asset.isImage ? null : 12)),
    isFavorite: assets.map(() => false),
    isTrashed: assets.map(() => false),
    livePhotoVideoId: assets.map(() => null),
    ownerId: assets.map(() => 'owner'),
    projectionType: assets.map(() => null),
    ratio: assets.map(ratioOf),
    thumbhash: assets.map(() => null),
    visibility: assets.map(() => AssetVisibility.Timeline),
  }
}

// GET /assets/{id}: the asset with its EXIF data, where its description is; undefined for an id
// the library does not have.
export function assetOf(library: FakeLibrary, id: string): AssetResponseDto | undefined {
  const asset = library.assets.find((candidate) => candidate.id === id)
  return asset === undefined ? undefined : assetResponseOf(asset, true)
}

// POST /search/random: the photos of the timeline, up to the size asked for. A fake server draws
// "at random" in the order of the library, so that the tests know what comes.
export function randomOf(library: FakeLibrary, size: number): AssetResponseDto[] {
  return assetsAsked(library, new URL('http://immich.test/'))
    .filter((asset) => asset.isImage)
    .slice(0, size)
    .map((asset) => assetResponseOf(asset, false))
}

// POST /search/metadata: the photos of the timeline taken between takenAfter and takenBefore, by
// the time on the clock of their place (orderBy), a page of the size asked for at a time (page, from
// 1). Only the filters the app sends are read.
export function searchedOf(library: FakeLibrary, body: unknown): SearchResponseDto {
  const after = Date.parse(textOf(body, 'takenAfter'))
  const before = Date.parse(textOf(body, 'takenBefore'))
  const orderBy: unknown = fieldOf(body, 'orderBy')
  const sign = fieldOf(orderBy, 'direction') === AssetOrder.Asc ? 1 : -1
  const size = Number(fieldOf(body, 'size'))
  const page = Number(fieldOf(body, 'page') ?? 1)
  const found = assetsAsked(library, new URL('http://immich.test/'))
    .filter((asset) => asset.isImage)
    .filter((asset) => Date.parse(asset.takenAt) >= after && Date.parse(asset.takenAt) <= before)
    .sort((first, second) => sign * (localMsOf(first) - localMsOf(second)))
  const items = found
    .slice((page - 1) * size, page * size)
    .map((asset) => assetResponseOf(asset, false))
  const nextPage = found.length > page * size ? String(page + 1) : null
  return {
    albums: { count: 0, facets: [], items: [], total: 0 },
    assets: {
      count: items.length,
      facets: [],
      items,
      nextCursor: null,
      nextPage,
      total: found.length,
    },
  }
}

function fieldOf(body: unknown, name: string): unknown {
  return typeof body === 'object' && body !== null ? Reflect.get(body, name) : undefined
}

function textOf(body: unknown, name: string): string {
  const value = fieldOf(body, name)
  return typeof value === 'string' ? value : ''
}

function localMsOf(asset: FakeAsset): number {
  return Date.parse(asset.takenAt) + asset.offsetHours * 3_600_000
}

function assetResponseOf(asset: FakeAsset, hasExif: boolean): AssetResponseDto {
  const local = new Date(localMsOf(asset)).toISOString()
  return {
    checksum: 'checksum',
    createdAt: asset.takenAt,
    duration: null,
    fileCreatedAt: asset.takenAt,
    fileModifiedAt: asset.takenAt,
    hasMetadata: true,
    height: HEIGHT,
    id: asset.id,
    isArchived: asset.isArchived === true,
    isEdited: false,
    isFavorite: false,
    isOffline: false,
    isTrashed: false,
    localDateTime: local,
    originalFileName: `${asset.id}.jpg`,
    originalPath: `/photos/${asset.id}.jpg`,
    ownerId: 'owner',
    thumbhash: null,
    type: asset.isImage ? AssetTypeEnum.Image : AssetTypeEnum.Video,
    updatedAt: asset.takenAt,
    visibility: asset.isArchived === true ? AssetVisibility.Archive : AssetVisibility.Timeline,
    width: Math.round(HEIGHT * ratioOf(asset)),
    ...(hasExif ? { exifInfo: { description: asset.description ?? '' } } : {}),
  }
}

function ratioOf(asset: FakeAsset): number {
  return asset.ratio ?? DEFAULT_RATIO
}

function monthOf(asset: FakeAsset): string {
  return `${asset.takenAt.slice(0, 7)}-01`
}
