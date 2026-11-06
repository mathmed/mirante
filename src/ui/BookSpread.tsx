import type { JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'

import { spreadsKept } from '../core/book-navigation.ts'
import {
  type Book,
  type BookLayouts,
  type BookPage,
  type BookPhoto,
  type CoverPage,
  type Frame,
  imageSizeOf,
  PageKind,
  type PhotoPage,
  type Spread,
} from '../core/book.ts'
import { zipWith } from '../core/lists.ts'
import type { PhotoLibrary } from '../core/photo-library.ts'
import { placeOf, type PresentationState, SlidePlace, type Upcoming } from '../core/presentation.ts'
import { periodText } from './book-messages.ts'
import { Mark } from './Logo.tsx'
import { MESSAGES, photoDateText, shortText } from './messages.ts'
import { Picture } from './Picture.tsx'

const PERCENT = 100
// What fits on two lines of the cover.
const TITLE_LENGTH = 60
// The pages of a spread.
const SIDES = 2

export interface BookStageProps {
  readonly book: Book
  readonly layouts: BookLayouts
  readonly library: PhotoLibrary
  readonly state: PresentationState
  readonly upcoming: Upcoming
  // The photo in focus on the spread on the screen; -1 when the focus is elsewhere.
  readonly frame: number
  // The number of each page, small, in a lower corner of its paper.
  readonly shouldShowNumbers: boolean
}

// The spreads kept decoded, at most two: the one on the screen, and the one leaving it or coming
// next, waiting beside it. A page turns by a short slide and a crossfade: transform and opacity.
// The spread is as large as the safe area allows in the shape of its two pages: a full screen
// spread fills it, a classic one is as wide.
export function BookStage(props: BookStageProps): JSX.Element {
  const spreadAspect = SIDES * props.layouts.pageAspect
  return (
    <div
      class="book-stage"
      style={{ maxWidth: `calc(var(--book-height) * ${String(spreadAspect)})` }}
    >
      <div class="book-sheet" style={{ paddingTop: `${String(PERCENT / spreadAspect)}%` }}>
        <Spreads {...props} />
      </div>
    </div>
  )
}

function Spreads(props: BookStageProps): JSX.Element {
  const { book, state } = props
  return (
    <>
      {spreadsKept(book, props).map((spread) => {
        const place = placeOf(state, spread)
        const isLeaving = spread.key === state.leaving?.key
        const classes = ['spread', `is-${place}`, ...(isLeaving ? ['is-leaving'] : [])]
        return (
          <div
            key={spread.key}
            class={classes.join(' ')}
            aria-hidden={place !== SlidePlace.Current}
          >
            <SpreadPages {...props} spread={spread} isCurrent={place === SlidePlace.Current} />
          </div>
        )
      })}
    </>
  )
}

interface SpreadPagesProps extends BookStageProps {
  readonly spread: Spread
  readonly isCurrent: boolean
}

// The left page and the right one, or the blank page after the last one; the photos of the right
// page come after those of the left one.
function SpreadPages(props: SpreadPagesProps): JSX.Element {
  const { spread, isCurrent, frame } = props
  const focused = isCurrent ? frame : -1
  const leftCount = spread.left.kind === PageKind.Photos ? spread.left.photos.length : 0
  return (
    <>
      <Page {...props} page={spread.left} side={PageSide.Left} focused={focused} />
      {spread.right === undefined ? (
        <div class="book-page is-right is-blank" />
      ) : (
        <Page {...props} page={spread.right} side={PageSide.Right} focused={focused - leftCount} />
      )}
    </>
  )
}

const PageSide = {
  Left: 'left',
  Right: 'right',
} as const

type PageSide = (typeof PageSide)[keyof typeof PageSide]

interface PageProps extends SpreadPagesProps {
  readonly page: BookPage
  // Its number goes in the outer corner, as in a printed book.
  readonly side: PageSide
  // The photo in focus on this page; out of its photos when the focus is elsewhere.
  readonly focused: number
}

function Page(props: PageProps): JSX.Element {
  const { page } = props
  return page.kind === PageKind.Cover ? (
    <Cover page={page} side={props.side} />
  ) : (
    <PhotosPage {...props} page={page} />
  )
}

function Cover({ page, side }: { readonly page: CoverPage; readonly side: PageSide }): JSX.Element {
  return (
    <div class={`book-page is-${side} book-cover`}>
      <Mark class="book-cover-mark" />
      <h2 class="book-cover-title">{shortText(page.title, TITLE_LENGTH)}</h2>
      <p class="book-cover-period">{periodText(page.first, page.last)}</p>
    </div>
  )
}

function PhotosPage(props: PageProps & { readonly page: PhotoPage }): JSX.Element {
  const { page, layouts, library, focused, side } = props
  const { frames } = layouts.layoutOf(page)
  return (
    <div class={`book-page is-${side}`}>
      {zipWith(frames, page.photos, (frame, photo) => ({ frame, photo })).map(
        ({ frame, photo }, index) => (
          <BookFrame
            key={photo.id}
            {...{ frame, photo, library }}
            pageAspect={layouts.pageAspect}
            isFocused={index === focused}
          />
        ),
      )}
      {props.shouldShowNumbers && <span class="book-folio">{String(page.number)}</span>}
    </div>
  )
}

interface BookFrameProps {
  readonly frame: Frame
  readonly photo: BookPhoto
  readonly library: PhotoLibrary
  readonly pageAspect: number
  readonly isFocused: boolean
}

// A photo on its page, where the layout puts it, whole: the thumbnail when it is small there, the
// preview when it is large. The photo in focus holds the browser's focus.
function BookFrame({ frame, photo, library, pageAspect, isFocused }: BookFrameProps): JSX.Element {
  const frameRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isFocused) {
      frameRef.current?.focus({ preventScroll: true })
    }
  }, [isFocused])
  const { x, y, width, height } = frame.photo
  const style = {
    left: `${String(x * PERCENT)}%`,
    top: `${String(y * PERCENT)}%`,
    width: `${String(width * PERCENT)}%`,
    height: `${String(height * PERCENT)}%`,
  }
  return (
    <div ref={frameRef} class="book-frame" style={style} tabIndex={-1} aria-current={isFocused}>
      <Picture
        url={library.imageUrl(photo.id, imageSizeOf(frame, pageAspect))}
        alt={photoDateText(photo.date)}
        missingText={MESSAGES.photoUnavailable}
      />
    </div>
  )
}
