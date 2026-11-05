// The library of the screenshots of the docs: albums of trips and family moments over three years,
// one of them empty, and a few loose photos in the timeline, each photo a landscape drawn from its
// id (scenes.ts) in the size asked for.
import type { FakeAsset, FakeLibrary } from '../test/immich-answers.ts'
import { scenePng } from './scenes.ts'

interface AlbumPlan {
  readonly id: string
  readonly name: string
  readonly photos: number
  // The day of its first photo, in UTC.
  readonly start: string
}

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
// Thumbnails as Immich serves them (small) and previews (the long side about 1440 pixels), 3:2.
const SIZES: ReadonlyMap<string, readonly [number, number]> = new Map([
  ['thumbnail', [360, 240]],
  ['preview', [1440, 960]],
])

const ALBUMS: readonly AlbumPlan[] = [
  { id: 'lisboa', name: 'Viagem a Lisboa', photos: 24, start: '2024-09-12T10:00:00.000Z' },
  { id: 'rosa', name: 'Praia do Rosa', photos: 18, start: '2024-01-04T12:00:00.000Z' },
  { id: 'natal', name: 'Natal em família', photos: 12, start: '2023-12-24T20:00:00.000Z' },
  { id: 'serra', name: 'Serra da Mantiqueira', photos: 16, start: '2023-07-15T09:00:00.000Z' },
  { id: 'ana', name: 'Aniversário da Ana', photos: 9, start: '2023-05-20T16:00:00.000Z' },
  { id: 'paraty', name: 'Fim de semana em Paraty', photos: 14, start: '2022-10-08T11:00:00.000Z' },
  { id: 'minas', name: 'Cachoeiras de Minas', photos: 20, start: '2022-03-19T10:00:00.000Z' },
  { id: 'mudanca', name: 'Mudança de casa', photos: 0, start: '2022-01-01T00:00:00.000Z' },
]

// Photos outside the albums, so that 2024 has months of its own.
const LOOSE_DAYS: readonly string[] = [
  '2024-02-10T15:00:00.000Z',
  '2024-04-21T10:00:00.000Z',
  '2024-06-13T18:00:00.000Z',
  '2024-07-28T09:00:00.000Z',
  '2024-11-02T17:00:00.000Z',
]

export const EMPTY_ALBUM = 'Mudança de casa'

export const SCREENSHOT_LIBRARY: FakeLibrary = {
  albums: ALBUMS.map(({ id, name }) => ({ id, name, isOldestFirst: true })),
  assets: [
    ...ALBUMS.flatMap((album) =>
      [...Array(album.photos).keys()].map((index) =>
        photo(`${album.id}-${String(index + 1)}`, Date.parse(album.start) + index * 5 * HOUR_MS, [
          album.id,
        ]),
      ),
    ),
    ...LOOSE_DAYS.flatMap((day, dayIndex) =>
      [0, 1, 2].map((index) =>
        photo(`solta-${String(dayIndex)}-${String(index)}`, Date.parse(day) + index * DAY_MS, []),
      ),
    ),
  ],
}

const drawn = new Map<string, Uint8Array>()

// The same photo in the same size is drawn once.
export function screenshotImage(photoId: string, size: string): Uint8Array {
  const key = `${photoId} ${size}`
  const [width, height] = SIZES.get(size) ?? [1, 1]
  const image = drawn.get(key) ?? scenePng(seedOf(photoId), width, height)
  drawn.set(key, image)
  return image
}

function photo(id: string, takenAtMs: number, albumIds: readonly string[]): FakeAsset {
  return {
    id,
    takenAt: new Date(takenAtMs).toISOString(),
    offsetHours: -3,
    isImage: true,
    albumIds,
  }
}

// FNV-1a over the code units of the id.
function seedOf(text: string): number {
  let hash = 2_166_136_261
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16_777_619)
  }
  return hash
}
