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
  // Assets in the trash are nowhere, until they are restored.
  readonly isTrashed?: boolean
  // The caption written for it in Immich.
  readonly description?: string
  // Its width over its height; 3:2 when left out.
  readonly ratio?: number
}

const DEFAULT_RATIO = 1.5
const HEIGHT = 1000

export interface FakeAlbum {
  readonly id: string
  readonly name: string
  readonly isOldestFirst?: boolean
}

export interface FakeLibrary {
  readonly albums: readonly FakeAlbum[]
  readonly assets: readonly FakeAsset[]
}

export function albumsOf(library: FakeLibrary): AlbumResponseDto[] {
  return library.albums.map((album) => albumOf(library, album))
}

export function albumOf(library: FakeLibrary, album: FakeAlbum): AlbumResponseDto {
  const assets = library.assets.filter(
    (asset) => asset.albumIds.includes(album.id) && asset.isTrashed !== true,
  )
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
}

// An album's assets when the request names one, else the timeline: everything not archived. What
// is in the trash is in neither.
export function assetsAsked(library: FakeLibrary, url: URL): readonly FakeAsset[] {
  const albumId = url.searchParams.get('albumId')
  const kept = library.assets.filter((asset) => asset.isTrashed !== true)
  return albumId === null
    ? kept.filter((asset) => asset.isArchived !== true)
    : kept.filter((asset) => asset.albumIds.includes(albumId))
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

// The fields Immich 3.3.6 takes beside filter and orderBy; each of its older flat filters
// (takenAfter, takenBefore, type, visibility, page, order, albumIds, withDeleted...) is refused with
// them. Checked against a real Immich 3.3.6, which answers 400 "Validation failed" then.
const SEARCH_FIELDS: ReadonlySet<string> = new Set([
  'filter',
  'orderBy',
  'size',
  'cursor',
  'withExif',
  'withPeople',
  'withStacked',
])
const NEW_SEARCH_FIELDS: readonly string[] = ['filter', 'orderBy']

// What Immich 3.3.6 answers, with a 400, to a search that mixes its deprecated flat filters with
// filter or orderBy; undefined when it takes the search.
export function searchRejectionOf(body: unknown): object | undefined {
  const fields = typeof body === 'object' && body !== null ? Object.keys(body) : []
  const newFields = NEW_SEARCH_FIELDS.filter((field) => fields.includes(field))
  const deprecated = fields.filter((field) => !SEARCH_FIELDS.has(field))
  if (newFields.length === 0 || deprecated.length === 0) {
    return undefined
  }
  const combined = newFields.join('/')
  return {
    message: 'Validation failed',
    errors: deprecated.map((field) => ({
      code: 'custom',
      path: [field],
      message: `Deprecated field ${field} cannot be combined with ${combined}`,
    })),
  }
}

// POST /search/metadata: the photos of the timeline taken in filter.takenAt (gte, lt), by the time
// on the clock of their place (orderBy), a page of the size asked for at a time, the next one
// behind the cursor of the previous one. Only the filters the app sends are read.
export function searchedOf(library: FakeLibrary, body: unknown): SearchResponseDto {
  const takenAt = fieldOf(fieldOf(body, 'filter'), 'takenAt')
  const after = Date.parse(textOf(takenAt, 'gte'))
  const before = Date.parse(textOf(takenAt, 'lt'))
  const sign = fieldOf(fieldOf(body, 'orderBy'), 'direction') === AssetOrder.Asc ? 1 : -1
  const size = Number(fieldOf(body, 'size'))
  const offset = offsetOf(fieldOf(body, 'cursor'))
  const found = assetsAsked(library, new URL('http://immich.test/'))
    .filter((asset) => asset.isImage)
    .filter((asset) => Date.parse(asset.takenAt) >= after && Date.parse(asset.takenAt) < before)
    .sort((first, second) => sign * (localMsOf(first) - localMsOf(second)))
  const items = found.slice(offset, offset + size).map((asset) => assetResponseOf(asset, false))
  const nextCursor = found.length > offset + size ? cursorOf(offset + size) : null
  return {
    albums: { count: 0, facets: [], items: [], total: 0 },
    assets: {
      count: items.length,
      facets: [],
      items,
      nextCursor,
      nextPage: null,
      total: found.length,
    },
  }
}

// Immich's cursor, opaque to the app: the offset of the next page, in base64 JSON.
function cursorOf(offset: number): string {
  return btoa(JSON.stringify({ offset }))
}

function offsetOf(cursor: unknown): number {
  return typeof cursor === 'string' ? Number(fieldOf(JSON.parse(atob(cursor)), 'offset')) : 0
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
