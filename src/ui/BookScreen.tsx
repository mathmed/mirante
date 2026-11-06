import type { JSX } from 'preact'
import { useCallback, useMemo, useState } from 'preact/hooks'

import { bookKeyOf, type BookSource, loadBookPhotos } from '../core/book-source.ts'
import {
  type Book,
  type BookLayouts,
  bookLayouts,
  type BookPhoto,
  firstPhotoOf,
  openingOf,
  photosOfBook,
  planBook,
} from '../core/book.ts'
import type { Photo } from '../core/photo-library.ts'
import { SourceKind } from '../core/presentation-source.ts'
import { type Slide, slideOf } from '../core/presentation.ts'
import { BookView } from './BookView.tsx'
import { Frame } from './Frame.tsx'
import { Loaded } from './Loaded.tsx'
import { MESSAGES, sourceTitle } from './messages.ts'
import type { BookControls, ScreenProps } from './screen-props.ts'
import { useLibraryLoad } from './use-load.ts'
import { SAME_SLIDES } from './use-presentation.ts'
import { Viewer } from './Viewer.tsx'

// Every photo weighs the same today; the book takes a weight for each, for a later version.
const SAME_WEIGHTS: ReadonlyMap<string, number> = new Map()

export interface BookScreenProps extends ScreenProps {
  readonly source: BookSource
  readonly books: BookControls
}

// An album or a month as a book of photos, laid out with the settings of the TV and the seed of the
// book: Back returns to where it was opened.
export function BookScreen(props: BookScreenProps): JSX.Element {
  const { library, source, keys, reportError, back } = props
  const task = useCallback(async () => loadBookPhotos(library, source), [library, source])
  const load = useLibraryLoad(task, reportError)
  return (
    <Frame title={sourceTitle(source)}>
      <Loaded
        load={load}
        emptyText={source.kind === SourceKind.Album ? MESSAGES.emptyAlbum : MESSAGES.emptyMonth}
        keys={keys}
        onBack={back}
        render={(photos) => <BookReader {...props} photos={photos} />}
      />
    </Frame>
  )
}

interface BookReaderProps extends BookScreenProps {
  readonly photos: readonly Photo[]
}

// Where the book opens: on the spread of this photo (the first spread for none), with the focus on
// it. Each opening shows the book anew.
interface Opening {
  readonly photoId: string | undefined
  readonly visit: number
}

// The book, or the viewer over it: a photo opens full screen, and Back returns to its spread. A
// new seed reorganizes the book, which opens on the same photos.
function BookReader(props: BookReaderProps): JSX.Element {
  const reader = useReader(props)
  const { book, photos, viewing } = reader
  if (viewing !== undefined) {
    return <BookPhotoViewer {...props} reader={reader} start={viewing} />
  }
  return (
    <BookView
      key={`${String(book.seed)} ${String(reader.opening.visit)}`}
      {...props}
      {...{ book, layouts: reader.layouts }}
      start={openingOf(book, reader.opening.photoId)}
      onOpen={(photoId) => {
        reader.setViewing(photos.findIndex(({ id }) => id === photoId))
      }}
      onJump={(spread) => {
        reader.reopen(firstPhotoOf(book, spread))
      }}
      onReorganize={reader.reorganize}
    />
  )
}

// The photos of the book, full screen, from the one chosen; Back opens the book on the photo shown
// last.
function BookPhotoViewer(
  props: BookReaderProps & { readonly reader: Reader; readonly start: number },
): JSX.Element {
  const { reader, start } = props
  return (
    <Viewer
      {...props}
      slides={reader.slides}
      start={start}
      shouldPlay={false}
      rounds={SAME_SLIDES}
      onClose={(index) => {
        reader.reopen(reader.photos.slice(index, index + 1).map(({ id }) => id)[0])
        reader.setViewing(undefined)
      }}
    />
  )
}

interface Reader {
  readonly book: Book
  readonly layouts: BookLayouts
  // Every photo of the book, in its order, and each as a slide of the viewer.
  readonly photos: readonly BookPhoto[]
  readonly slides: readonly Slide[]
  readonly opening: Opening
  readonly reopen: (photoId: string | undefined) => void
  readonly reorganize: (photoId: string) => void
  // The photo open in the viewer, by its place in the book.
  readonly viewing: number | undefined
  readonly setViewing: (index: number | undefined) => void
}

function useReader(props: BookReaderProps): Reader {
  const { source, books } = props
  const key = bookKeyOf(source)
  const book = useBook(props, books.seedOf(key))
  const layouts = useMemo(() => bookLayouts(book), [book])
  const photos = useMemo(() => photosOfBook(book), [book])
  const slides = useMemo(() => photos.map(slideOf), [photos])
  const [opening, setOpening] = useState<Opening>({ photoId: undefined, visit: 0 })
  const [viewing, setViewing] = useState<number | undefined>(undefined)
  const reopen = useCallback((photoId: string | undefined) => {
    setOpening((previous) => ({ photoId, visit: previous.visit + 1 }))
  }, [])
  const reorganize = useCallback(
    (photoId: string) => {
      books.reorganize(key)
      reopen(photoId)
    },
    [books, key, reopen],
  )
  return { book, layouts, photos, slides, opening, reopen, reorganize, viewing, setViewing }
}

function useBook(props: BookReaderProps, seed: number): Book {
  const { photos, source, presentation } = props
  const { bookDensity: density, shouldShowBookCover: hasCover } = presentation.settings
  return useMemo(
    () =>
      planBook(photos, {
        title: sourceTitle(source),
        seed,
        density,
        hasCover,
        weights: SAME_WEIGHTS,
      }),
    [photos, source, seed, density, hasCover],
  )
}
