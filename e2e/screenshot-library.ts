// The library of the screenshots of the docs: albums of trips and family moments over three years,
// one of them empty, and a few loose photos in the timeline, each photo a landscape drawn from its
// id (scenes.ts) in the size asked for; a few photos of the trip to Lisbon have a caption. The photos
// of the waterfalls of Minas, the book of the screenshots, come in every shape.
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
// The long side of the thumbnails as Immich serves them (small) and of the previews.
const LONG_SIDES: ReadonlyMap<string, number> = new Map([
  ['thumbnail', 360],
  ['preview', 1440],
])
const LANDSCAPE = 3 / 2
const BOOK_ALBUM_ID = 'minas'
// The shapes of the photos of the book, width over height, in turn: portraits of the falls,
// landscapes of the valleys, a square, a panorama of the ridge.
const BOOK_RATIOS: readonly number[] = [
  3 / 2,
  2 / 3,
  3 / 4,
  3 / 2,
  1,
  3,
  2 / 3,
  2 / 3,
  16 / 9,
  3 / 2,
  9 / 16,
  4 / 3,
  3 / 2,
  2 / 3,
  1,
  16 / 9,
  3 / 4,
  3 / 2,
  3,
  2 / 3,
]

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
export const BOOK_ALBUM = 'Cachoeiras de Minas'

// The captions written in Immich for a few photos of the trip to Lisbon.
const CAPTIONS: ReadonlyMap<string, string> = new Map([
  ['lisboa-9', 'O bonde 28 subindo para a Alfama'],
  ['lisboa-10', 'Fim de tarde no Miradouro de Santa Luzia'],
  ['lisboa-11', 'Pastéis de nata ainda quentes em Belém'],
  ['minas-1', 'O vale ainda na neblina, antes da trilha'],
  ['minas-2', 'A Cachoeira do Tabuleiro, do mirante'],
])

export const BOOK_PHOTO_IDS: readonly string[] = [...BOOK_RATIOS.keys()].map(
  (index) => `${BOOK_ALBUM_ID}-${String(index + 1)}`,
)

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
  const [width, height] = sizeOf(ratioOf(photoId), LONG_SIDES.get(size) ?? 1)
  const image = drawn.get(key) ?? scenePng(seedOf(photoId), width, height)
  drawn.set(key, image)
  return image
}

function photo(id: string, takenAtMs: number, albumIds: readonly string[]): FakeAsset {
  const description = CAPTIONS.get(id)
  return {
    id,
    takenAt: new Date(takenAtMs).toISOString(),
    offsetHours: -3,
    isImage: true,
    albumIds,
    ratio: ratioOf(id),
    ...(description === undefined ? {} : { description }),
  }
}

// The photos of the book in every shape; the others, 3:2.
function ratioOf(photoId: string): number {
  const [album, number] = photoId.split('-')
  const ratio = album === BOOK_ALBUM_ID ? BOOK_RATIOS[Number(number) - 1] : undefined
  return ratio ?? LANDSCAPE
}

function sizeOf(ratio: number, longSide: number): readonly [number, number] {
  return ratio >= 1
    ? [longSide, Math.round(longSide / ratio)]
    : [Math.round(longSide * ratio), longSide]
}

// FNV-1a over the code units of the id.
function seedOf(text: string): number {
  let hash = 2_166_136_261
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16_777_619)
  }
  return hash
}
