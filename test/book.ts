import { act, render } from '@testing-library/preact'
import { h } from 'preact'
import { vi } from 'vitest'

import { pageAspectOf } from '../src/core/book-geometry.ts'
import { bookKeyOf, type BookSource } from '../src/core/book-source.ts'
import { type Book, planBook } from '../src/core/book.ts'
import { START_POSITION } from '../src/core/grid.ts'
import { type Photo, type PhotoLibrary, PhotoOrder } from '../src/core/photo-library.ts'
import type { PresentationSettings } from '../src/core/presentation-settings.ts'
import { SourceKind } from '../src/core/presentation-source.ts'
import { BookScreen } from '../src/ui/BookScreen.tsx'
import { sourceTitle } from '../src/ui/messages.ts'
import { mixedPhotos } from './book-photos.ts'
import { memoryLibrary } from './library-stub.ts'
import { presentationControls } from './presentation-controls.ts'
import { fakeRemote, type FakeRemote } from './remote.ts'

// The book of the component tests: an album of photos of every shape (book-photos.ts), laid out
// with the seed the test gives it, over a library in memory. The tests run on fake timers: the
// photos and the captions arrive once settled() lets the promises run.
export const BOOK_ALBUM = {
  id: 'walk',
  name: 'Passeio na serra',
  photoCount: 40,
  order: PhotoOrder.OldestFirst,
}

export const ALBUM_SOURCE: BookSource = { kind: SourceKind.Album, album: BOOK_ALBUM }

const MICROTASKS = 10
const FIRST_SEED = 7
const NEXT_SEED = 1000

export interface BookOptions {
  readonly photos: readonly Photo[]
  readonly source: BookSource
  readonly settings: Partial<PresentationSettings>
  readonly captions: ReadonlyMap<string, string>
}

export interface ShownBook {
  readonly remote: FakeRemote
  readonly reported: unknown[]
  readonly back: () => void
  // The keys of the books reorganized, in turn.
  readonly reorganized: string[]
  // The book the screen shows now, as the core plans it.
  readonly book: () => Book
}

export function showBook(options: Partial<BookOptions> = {}): ShownBook {
  const { photos, source, settings, captions } = {
    photos: mixedPhotos(BOOK_ALBUM.photoCount),
    source: ALBUM_SOURCE,
    settings: {},
    captions: new Map<string, string>(),
    ...options,
  }
  const remote = fakeRemote()
  const reported: unknown[] = []
  const back = vi.fn<() => void>()
  const reorganized: string[] = []
  const seeds = new Map<string, number>()
  const { controls } = presentationControls(settings)
  const library = bookLibrary(source, photos, captions)
  render(
    h(BookScreen, {
      library,
      source,
      keys: remote.keys,
      reportError: (error) => reported.push(error),
      position: START_POSITION,
      open: () => undefined,
      back,
      presentation: controls,
      books: {
        seedOf: (key) => seeds.get(key) ?? FIRST_SEED,
        reorganize: (key) => {
          reorganized.push(key)
          seeds.set(key, NEXT_SEED + reorganized.length)
        },
      },
    }),
  )
  const book = (): Book =>
    planBook(photos, {
      title: sourceTitle(source),
      seed: seeds.get(bookKeyOf(source)) ?? FIRST_SEED,
      density: controls.settings.bookDensity,
      hasCover: controls.settings.shouldShowBookCover,
      pageAspect: pageAspectOf(controls.settings.bookFormat),
      weights: new Map(),
    })
  return { remote, reported, back, reorganized, book }
}

function bookLibrary(
  source: BookSource,
  photos: readonly Photo[],
  captions: ReadonlyMap<string, string>,
): PhotoLibrary {
  const isAlbum = source.kind === SourceKind.Album
  return memoryLibrary({
    server: { address: 'immich.test', version: '3.3.6' },
    albums: isAlbum ? [source.album] : [],
    albumPhotos: new Map(isAlbum ? [[source.album.id, photos]] : []),
    months: isAlbum ? [] : [source.month],
    monthPhotos: new Map(isAlbum ? [] : [[source.month.key, photos]]),
    captions,
  })
}

// The promises run: the photos, the captions, the images.
export async function settled(): Promise<void> {
  await act(async () => {
    for (let tick = 0; tick < MICROTASKS; tick += 1) {
      await Promise.resolve()
    }
  })
}

export async function elapse(ms: number): Promise<void> {
  void act(() => {
    vi.advanceTimersByTime(ms)
  })
  await settled()
}

// "Capa e página 1", "Páginas 2 e 3": the pages on the screen, as the layer of the controls says.
export function shownPages(): string | null | undefined {
  return document.querySelector('.book-layer-pages')?.textContent
}

// "12", "13": the numbers printed in the corners of the pages on the screen.
export function folios(): readonly (string | null)[] {
  return [...document.querySelectorAll('.spread.is-current .book-folio')].map(
    (folio) => folio.textContent,
  )
}

// Whether the layer of the controls shows over the book.
export function isLayerShown(): boolean {
  return document.querySelector('.book-layer')?.classList.contains('is-shown') ?? false
}

// The photos of the spread on the screen, left page first, by id.
export function shownPhotos(): readonly string[] {
  return [...document.querySelectorAll('.spread.is-current .book-frame img')].map(
    (image) => image.getAttribute('src')?.split('/').pop() ?? '',
  )
}

// The photo in focus, by id; or the text of the button or of the spread of the strip in focus.
export function focusedPhoto(): string | undefined {
  return document.activeElement?.querySelector('img')?.getAttribute('src')?.split('/').pop()
}
