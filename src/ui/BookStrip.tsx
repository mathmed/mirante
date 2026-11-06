import type { JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'

import { type BookFocus, BookZone, photoPagesOf, stripStart } from '../core/book-navigation.ts'
import { type Book, type BookLayouts, type BookPage, PageKind, type Spread } from '../core/book.ts'
import { spreadText } from './book-messages.ts'
import { useWarmLayouts } from './use-warm-layouts.ts'

// The spreads the strip shows at once.
const SHOWN = 7
const PERCENT = 100
// The pages of a spread.
const SIDES = 2

export interface BookStripProps {
  readonly book: Book
  readonly layouts: BookLayouts
  // The spread on the screen.
  readonly current: number
  readonly focus: BookFocus
}

// The spreads of the book in miniature, under the bar, around the one on the screen (marked) or
// the one in focus. Only those shown are drawn, in blocks: no image loads for them.
export function BookStrip({ book, layouts, current, focus }: BookStripProps): JSX.Element {
  const focused = focus.zone === BookZone.Strip ? focus.spread : -1
  const start = stripStart(focused < 0 ? current : focused, book.spreads.length, SHOWN)
  const shown = book.spreads.slice(start, start + SHOWN)
  useWarmLayouts(layouts, photoPagesOf(shown))
  return (
    <ul class="book-strip">
      {shown.map((spread, offset) => (
        <StripSpread
          key={spread.key}
          {...{ spread, layouts }}
          isCurrent={start + offset === current}
          isFocused={start + offset === focused}
        />
      ))}
    </ul>
  )
}

interface StripSpreadProps {
  readonly spread: Spread
  readonly layouts: BookLayouts
  readonly isCurrent: boolean
  readonly isFocused: boolean
}

function StripSpread({ spread, layouts, isCurrent, isFocused }: StripSpreadProps): JSX.Element {
  const itemRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (isFocused) {
      itemRef.current?.focus({ preventScroll: true })
    }
  }, [isFocused])
  return (
    <li
      ref={itemRef}
      class={isCurrent ? 'book-strip-item is-current' : 'book-strip-item'}
      tabIndex={-1}
      aria-label={spreadText(spread)}
      aria-current={isFocused}
    >
      <MiniSpread spread={spread} layouts={layouts} />
    </li>
  )
}

export interface MiniSpreadProps {
  readonly spread: Spread
  readonly layouts: BookLayouts
}

// A spread in miniature, in the shape of the book: the paper of its pages and a block where each
// photo is, once laid out.
export function MiniSpread({ spread, layouts }: MiniSpreadProps): JSX.Element {
  const spreadAspect = SIDES * layouts.pageAspect
  return (
    <div class="mini-spread" style={{ '--spread-aspect': String(spreadAspect) }}>
      <div class="mini-sheet" style={{ paddingTop: `${String(PERCENT / spreadAspect)}%` }}>
        <MiniPage page={spread.left} layouts={layouts} />
        <MiniPage page={spread.right} layouts={layouts} />
      </div>
    </div>
  )
}

function MiniPage({
  page,
  layouts,
}: {
  readonly page: BookPage | undefined
  readonly layouts: BookLayouts
}): JSX.Element {
  if (page?.kind !== PageKind.Photos) {
    return <div class={page === undefined ? 'mini-page is-blank' : 'mini-page mini-cover'} />
  }
  const frames = layouts.isLaidOut(page) ? layouts.layoutOf(page).frames : []
  return (
    <div class="mini-page">
      {frames.map(({ photoId, photo }) => (
        <span
          key={photoId}
          class="mini-photo"
          style={{
            left: `${String(photo.x * PERCENT)}%`,
            top: `${String(photo.y * PERCENT)}%`,
            width: `${String(photo.width * PERCENT)}%`,
            height: `${String(photo.height * PERCENT)}%`,
          }}
        />
      ))}
    </div>
  )
}
