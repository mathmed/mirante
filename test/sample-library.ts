import type { FakeAsset, FakeLibrary } from './fake-immich.ts'

// A small library for the tests: a trip over two months with a video among its photos, a family
// album with an archived photo, and an empty album.
export const TRIP = { id: 'album-trip', name: 'Viagem a Lisboa', isOldestFirst: true }
export const FAMILY = { id: 'album-family', name: 'Família' }
export const EMPTY = { id: 'album-empty', name: 'Sem fotos' }

export const TRIP_PHOTOS = 14
const MARCH_PHOTOS = 8
const MINUTE_MS = 60_000
const MARCH_START = Date.parse('2024-03-20T12:00:00.000Z')
const APRIL_START = Date.parse('2024-04-02T09:00:00.000Z')

function tripPhoto(number: number): FakeAsset {
  const isMarch = number < MARCH_PHOTOS
  const start = isMarch ? MARCH_START : APRIL_START
  return {
    id: `trip-${String(number).padStart(2, '0')}`,
    takenAt: new Date(start + number * MINUTE_MS).toISOString(),
    offsetHours: 0,
    isImage: true,
    albumIds: [TRIP.id],
  }
}

export const SAMPLE_LIBRARY: FakeLibrary = {
  albums: [TRIP, FAMILY, EMPTY],
  assets: [
    ...[...Array(TRIP_PHOTOS).keys()].map(tripPhoto),
    {
      id: 'trip-video',
      takenAt: '2024-03-21T10:00:00.000Z',
      offsetHours: 0,
      isImage: false,
      albumIds: [TRIP.id],
    },
    // Taken on the evening of December 24th in Brazil: still the 24th there, the 25th in UTC.
    {
      id: 'family-dinner',
      takenAt: '2023-12-25T01:30:00.000Z',
      offsetHours: -3,
      isImage: true,
      albumIds: [FAMILY.id],
    },
    {
      id: 'family-archived',
      takenAt: '2023-12-26T15:00:00.000Z',
      offsetHours: -3,
      isImage: true,
      albumIds: [FAMILY.id],
      isArchived: true,
    },
  ],
}
