import { normalized, PAGE_ASPECT, type Rect } from './book-geometry.ts'
import { type BookDensity, paginate } from './book-pagination.ts'
import { sortPhotos } from './gallery.ts'
import { firstOr, zipWith } from './lists.ts'
import { type PageCandidate, type PageSearch, searchPage } from './page-layout.ts'
import { ImageSize, type Photo, type PhotoDate, PhotoOrder } from './photo-library.ts'
import { roundSeed } from './shuffle.ts'

// An album or a month as a book of photos: a cover, if wanted, then pages of photos in the order of
// the album, two by two in spreads. How many photos each page takes is decided for the whole book
// at once (book-pagination.ts); where they go on a page is decided page by page, when the page is
// first shown (page-layout.ts), so that a book of thousands of photos opens at once. The same
// photos, options and seed always make the same book, and what the book is made of is plain data.

// A photo of the book, with how much of its page it asks for.
export interface BookPhoto extends Photo {
  readonly weight: number
}

export const PageKind = {
  Cover: 'cover',
  Photos: 'photos',
} as const

export interface CoverPage {
  readonly kind: typeof PageKind.Cover
  readonly title: string
  // The days of the first and the last photo.
  readonly first: PhotoDate
  readonly last: PhotoDate
}

export interface PhotoPage {
  readonly kind: typeof PageKind.Photos
  // From 1.
  readonly number: number
  readonly photos: readonly [BookPhoto, ...BookPhoto[]]
}

export type BookPage = CoverPage | PhotoPage

// Two facing pages. Its key and its photos make it a slide of the presentation engine.
export interface Spread {
  readonly key: string
  readonly left: BookPage
  // None after the last page of a book of an odd number of pages: a blank page.
  readonly right: PhotoPage | undefined
  readonly photos: readonly [BookPhoto, ...BookPhoto[]]
}

export interface Book {
  readonly seed: number
  readonly density: BookDensity
  // The width of a page over its height.
  readonly pageAspect: number
  readonly cover: CoverPage | undefined
  readonly pages: readonly PhotoPage[]
  readonly spreads: readonly Spread[]
}

export interface BookOptions {
  // The name of the album or of the month, for the cover.
  readonly title: string
  readonly seed: number
  readonly density: BookDensity
  readonly hasCover: boolean
  // How much of its page a photo asks for, by its id; 1 for a photo left out.
  readonly weights: ReadonlyMap<string, number>
}

// A photo on its page, in fractions of the width and of the height of the page: its box, and the
// photo, whole, centered in it.
export interface Frame {
  readonly photoId: string
  readonly weight: number
  readonly cell: Rect
  readonly photo: Rect
}

export interface PageLayout {
  readonly number: number
  // How the page is cut, as "row(1,column(1,1))".
  readonly arrangement: string
  readonly frames: readonly Frame[]
}

// Each page is laid out once, when first asked for, and kept.
export interface BookLayouts {
  readonly layoutOf: (page: PhotoPage) => PageLayout
  readonly isLaidOut: (page: PhotoPage) => boolean
}

const DEFAULT_WEIGHT = 1
// A photo whose shorter side takes less of the height of the page than this loads its thumbnail
// (Immich's are 250 pixels on their shorter side; a page is about 550 pixels high on a TV).
const THUMBNAIL_SIDE = 0.4
// Every few pages, a page avoids the two best arrangements of the page before it instead of the
// one that page took: it then needs no page further back, so that any page is laid out after a
// few others at most.
const ANCHOR_EVERY = 4
const AVOIDED_AT_ANCHORS = 2

export function planBook(photos: readonly Photo[], options: BookOptions): Book {
  const bookPhotos = withoutRepeats(photos).map((photo) => ({
    ...photo,
    weight: options.weights.get(photo.id) ?? DEFAULT_WEIGHT,
  }))
  const pages = paginate(bookPhotos, { ...options }).map((pagePhotos, index): PhotoPage => ({
    kind: PageKind.Photos,
    number: index + 1,
    photos: pagePhotos,
  }))
  const cover = options.hasCover ? coverOf(bookPhotos, options.title) : undefined
  return {
    seed: options.seed,
    density: options.density,
    pageAspect: PAGE_ASPECT,
    cover,
    pages,
    spreads: spreadsOf(pages, cover),
  }
}

// The small image for a small photo on its page, the preview for a large one; never the original.
export function imageSizeOf(frame: Frame): ImageSize {
  const shorterSide = Math.min(frame.photo.width * PAGE_ASPECT, frame.photo.height)
  return shorterSide < THUMBNAIL_SIDE ? ImageSize.Thumbnail : ImageSize.Preview
}

// Every photo of the book, in its order.
export function photosOfBook(book: Book): readonly BookPhoto[] {
  return ([] as BookPhoto[]).concat(...book.spreads.map(({ photos }) => photos))
}

// Where a book opens on a photo: its spread, and its place there (left page first). The first
// photo of the book for a photo it does not have, or none.
export function openingOf(
  book: Book,
  photoId: string | undefined,
): { readonly spread: number; readonly frame: number } {
  const spread = spreadOfPhoto(book, photoId ?? '')
  const [photos = []] = book.spreads.slice(spread, spread + 1).map((opened) => opened.photos)
  return {
    spread,
    frame: Math.max(
      0,
      photos.findIndex(({ id }) => id === photoId),
    ),
  }
}

// None past the last spread.
export function spreadAt(book: Book, index: number): Spread | undefined {
  const [spread] = book.spreads.slice(index, index + 1)
  return spread
}

// The first photo of a spread; none past the last spread.
export function firstPhotoOf(book: Book, spread: number): string | undefined {
  const [photoId] = book.spreads.slice(spread, spread + 1).map(({ photos }) => photos[0].id)
  return photoId
}

// The spread a photo is on; the first one for a photo the book does not have.
export function spreadOfPhoto(book: Book, photoId: string): number {
  return Math.max(
    0,
    book.spreads.findIndex((spread) => spread.photos.some(({ id }) => id === photoId)),
  )
}

export function bookLayouts(book: Book): BookLayouts {
  const searches = new Map<number, PageSearch>()
  const chosen = new Map<number, PageLayout>()
  const searchOf = (page: PhotoPage): PageSearch =>
    remembered(searches, page.number, () =>
      searchPage(page.photos, roundSeed(book.seed, page.number)),
    )
  const choose = (page: PhotoPage): PageLayout =>
    remembered(chosen, page.number, () => {
      const index = page.number - 1
      const previous = book.pages[index - 1]
      const search = searchOf(page)
      const candidate =
        previous === undefined
          ? search.best
          : avoiding(search, avoidedAfter(previous, { page, searchOf, choose }))
      return layoutOf(page, candidate)
    })
  return { layoutOf: choose, isLaidOut: (page) => chosen.has(page.number) }
}

interface Choosing {
  readonly page: PhotoPage
  readonly searchOf: (page: PhotoPage) => PageSearch
  readonly choose: (page: PhotoPage) => PageLayout
}

// What a page must not repeat of the page before it: the arrangement that page took or, on the
// pages that anchor the others (5, 9, 13...), the two that page could take.
function avoidedAfter(previous: PhotoPage, choosing: Choosing): readonly string[] {
  if (choosing.page.number % ANCHOR_EVERY !== 1) {
    return [choosing.choose(previous).arrangement]
  }
  const search = choosing.searchOf(previous)
  return [search.best, ...search.others]
    .slice(0, AVOIDED_AT_ANCHORS)
    .map(({ signature }) => signature)
}

// The best arrangement the page before has not taken; the best one when every other is taken.
function avoiding(search: PageSearch, avoided: readonly string[]): PageCandidate {
  const allowed = [search.best, ...search.others].filter(
    ({ signature }) => !avoided.includes(signature),
  )
  return firstOr(allowed, search.best)
}

function layoutOf(page: PhotoPage, candidate: PageCandidate): PageLayout {
  return {
    number: page.number,
    arrangement: candidate.signature,
    frames: zipWith(page.photos, candidate.placements, (photo, placement) => ({
      photoId: photo.id,
      weight: photo.weight,
      cell: normalized(placement.cell),
      photo: normalized(placement.photo),
    })),
  }
}

function remembered<V>(known: Map<number, V>, key: number, compute: () => V): V {
  const value = known.get(key) ?? compute()
  known.set(key, value)
  return value
}

// The title of the album over the days of its first and last photos.
function coverOf(photos: readonly Photo[], title: string): CoverPage | undefined {
  const sorted = sortPhotos(photos, PhotoOrder.OldestFirst)
  const [first] = sorted
  const [last] = sorted.slice(-1)
  if (first === undefined || last === undefined) {
    return undefined
  }
  return { kind: PageKind.Cover, title, first: first.date, last: last.date }
}

// The cover faces the first page; the other pages face each other, two by two.
function spreadsOf(pages: readonly PhotoPage[], cover: CoverPage | undefined): readonly Spread[] {
  const [first, ...rest] = pages
  if (cover === undefined || first === undefined) {
    return pairedSpreads(pages, 0)
  }
  return [
    { key: spreadKey(0), left: cover, right: first, photos: first.photos },
    ...pairedSpreads(rest, 1),
  ]
}

function pairedSpreads(pages: readonly PhotoPage[], firstIndex: number): readonly Spread[] {
  const queue = [...pages]
  const spreads: Spread[] = []
  for (let left = queue.shift(); left !== undefined; left = queue.shift()) {
    const right = queue.shift()
    const [firstPhoto, ...leftPhotos] = left.photos
    spreads.push({
      key: spreadKey(firstIndex + spreads.length),
      left,
      right,
      photos: [firstPhoto, ...leftPhotos, ...(right === undefined ? [] : right.photos)],
    })
  }
  return spreads
}

function spreadKey(index: number): string {
  return `spread-${String(index)}`
}

function withoutRepeats(photos: readonly Photo[]): readonly Photo[] {
  const ids = new Set<string>()
  return photos.filter(({ id }) => {
    const isNew = !ids.has(id)
    ids.add(id)
    return isNew
  })
}
