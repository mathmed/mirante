import type { JSX } from 'preact'

import type { BookFocus } from '../core/book-navigation.ts'
import type { Book, BookLayouts, Spread } from '../core/book.ts'
import { spreadText } from './book-messages.ts'
import { BookBar } from './BookBar.tsx'
import { BookStrip } from './BookStrip.tsx'
import { Mark } from './Logo.tsx'
import { MESSAGES, shortText } from './messages.ts'

// What fits on one line of the title, beside the pages and the mark.
const TITLE_LENGTH = 48

export interface BookLayerProps {
  readonly title: string
  readonly book: Book
  readonly layouts: BookLayouts
  readonly spread: Spread
  // The spread on the screen.
  readonly current: number
  readonly focus: BookFocus
  readonly isPlaying: boolean
  readonly isShown: boolean
  // While the overview covers the bar, its button waits to take the focus back.
  readonly isCovered: boolean
}

// The controls of the book, over it, only when asked for: at the top the title, the pages on the
// screen and the mark; at the bottom the bar of the buttons, the strip of the spreads and the keys.
// Hidden, it stays in the page, invisible, so that it fades in and out.
export function BookLayer(props: BookLayerProps): JSX.Element {
  const { title, book, layouts, spread, current, focus, isPlaying, isShown, isCovered } = props
  return (
    <div class={isShown ? 'book-layer is-shown' : 'book-layer'} aria-hidden={!isShown}>
      <div class="book-layer-top">
        <p class="book-layer-title">{shortText(title, TITLE_LENGTH)}</p>
        <p class="book-layer-pages">{spreadText(spread)}</p>
        <Mark class="book-layer-mark" />
      </div>
      <div class="book-layer-bottom">
        <BookBar focus={focus} isPlaying={isPlaying} isCovered={isCovered} />
        <BookStrip book={book} layouts={layouts} current={current} focus={focus} />
        <p class="book-keys">{MESSAGES.bookKeys}</p>
      </div>
    </div>
  )
}
