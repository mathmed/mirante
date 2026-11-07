import { render, screen, waitFor } from '@testing-library/preact'
import { h } from 'preact'
import { expect, type Mock, vi } from 'vitest'

import type { LibraryEditor } from '../src/core/library-editor.ts'
import { type PhotoLibrary, PhotoOrder } from '../src/core/photo-library.ts'
import {
  DEFAULT_PRESENTATION,
  type PresentationSettings,
} from '../src/core/presentation-settings.ts'
import { Gallery } from '../src/ui/Gallery.tsx'
import { NO_GRANT, recordingEditor } from './editor-stub.ts'
import { memoryLibrary, type MemoryLibrary, photos } from './library-stub.ts'
import { memoryStorage } from './memory-storage.ts'
import { fakeRemote, type FakeRemote } from './remote.ts'

// The gallery of the component tests: a library in memory with a trip of 30 photos, a family album
// of 3 and an empty one, and a timeline from December 2023 to May 2024 (December holds a video
// only, May nothing).
// The day of the start screen: no photo of the library is near it in a past year.
const TODAY = { year: 2026, month: 11, day: 7 }
const SERVER = { address: '192.168.0.10:2283', version: '3.3.6' }

export const TRIP = {
  id: 'trip',
  name: 'Viagem a Lisboa',
  photoCount: 30,
  coverPhotoId: 'trip-1',
  order: PhotoOrder.OldestFirst,
  lastPhotoAtMs: Date.UTC(2024, 2, 30),
}
export const FAMILY = {
  id: 'family',
  name: 'Família',
  photoCount: 3,
  order: PhotoOrder.NewestFirst,
  lastPhotoAtMs: Date.UTC(2023, 11, 3),
}
export const EMPTY = {
  id: 'empty',
  name: 'Sem fotos',
  photoCount: 0,
  order: PhotoOrder.NewestFirst,
}

export const DATA: MemoryLibrary = {
  server: SERVER,
  albums: [EMPTY, FAMILY, TRIP],
  albumPhotos: new Map([
    [TRIP.id, photos('trip', 30)],
    [FAMILY.id, photos('family', 3, { year: 2023, month: 12 })],
  ]),
  months: [
    // A video only: Immich counts it, the gallery leaves it out.
    { key: 'm-2023-12', year: 2023, month: 12, photoCount: 1 },
    { key: 'm-2024-04', year: 2024, month: 4, photoCount: 2 },
    { key: 'm-2024-03', year: 2024, month: 3, photoCount: 10 },
    { key: 'm-2024-05', year: 2024, month: 5, photoCount: 0 },
  ],
  monthPhotos: new Map([
    ['m-2024-03', photos('march', 10)],
    ['m-2024-04', photos('april', 2, { year: 2024, month: 4 })],
  ]),
  captions: new Map([['april-1', 'Abril em flor']]),
}

export interface ShownGallery {
  readonly remote: FakeRemote
  readonly reported: unknown[]
  readonly leave: Mock<() => void>
  // What the TV kept of its settings, and of the seeds of its books.
  readonly written: string[]
  readonly booksWritten: string[]
}

export interface GalleryOptions {
  readonly library?: PhotoLibrary
  // The changes it may make; by default, none: the installation reads only.
  readonly editor?: LibraryEditor
  readonly defaults?: PresentationSettings
  // The settings the TV kept before, as stored.
  readonly stored?: string
  // The seeds of the books the TV kept before, as stored.
  readonly storedBooks?: string
}

export function showGallery(options: GalleryOptions = {}): ShownGallery {
  const remote = fakeRemote()
  const reported: unknown[] = []
  const leave = vi.fn<() => void>()
  const { storage, written } = memoryStorage(options.stored)
  const books = memoryStorage(options.storedBooks)
  const library = options.library ?? memoryLibrary(DATA)
  const editor = options.editor ?? recordingEditor(NO_GRANT).editor
  const presentationDefaults = options.defaults ?? DEFAULT_PRESENTATION
  render(
    h(Gallery, {
      session: { server: SERVER, library, editor, presentationDefaults },
      keys: remote.keys,
      reportError: (error) => reported.push(error),
      leave,
      storage,
      bookStorage: books.storage,
      newSeed: () => 1,
      today: () => TODAY,
    }),
  )
  return { remote, reported, leave, written, booksWritten: books.written }
}

export async function title(text: string): Promise<void> {
  await screen.findByRole('heading', { level: 1, name: text })
}

export function focused(): string | null | undefined {
  return document.activeElement?.textContent
}

export async function focusedOn(text: string): Promise<void> {
  await waitFor(() => {
    expect(focused()).toContain(text)
  })
}
