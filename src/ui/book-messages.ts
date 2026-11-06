import { BookControl } from '../core/book-navigation.ts'
import { type BookPage, PageKind, type PhotoPage, type Spread } from '../core/book.ts'
import type { PhotoDate } from '../core/photo-library.ts'
import { capitalized, MESSAGES, monthOf, textOf } from './messages.ts'

// A button of the bar: what it shows, and what it says to a screen reader.
export interface ControlText {
  readonly text: string
  readonly label: string
}

const CONTROLS: ReadonlyMap<BookControl, ControlText> = new Map([
  [BookControl.Previous, { text: '‹', label: MESSAGES.previousSpread }],
  [BookControl.Overview, { text: MESSAGES.bookOverview, label: MESSAGES.bookOverview }],
  [BookControl.Reorganize, { text: MESSAGES.reorganizeBook, label: MESSAGES.reorganizeBook }],
  [BookControl.Next, { text: '›', label: MESSAGES.nextSpread }],
])

const PLAY: ControlText = { text: MESSAGES.playBook, label: MESSAGES.playBook }
const PAUSE: ControlText = { text: MESSAGES.pauseBook, label: MESSAGES.pauseBook }

// What the book says, in Brazilian Portuguese, beyond the short texts of MESSAGES. A companion of
// messages.ts.

// "Página 12".
function pageNumberText(number: number): string {
  return `Página ${String(number)}`
}

// The days of the photos of a book, on its cover: "Março de 2024", "Março a abril de 2024",
// "Dezembro de 2023 a janeiro de 2024".
export function periodText(first: PhotoDate, last: PhotoDate): string {
  const end = `${monthOf(last.month)} de ${String(last.year)}`
  if (first.year !== last.year) {
    return capitalized(`${monthOf(first.month)} de ${String(first.year)} a ${end}`)
  }
  return capitalized(first.month === last.month ? end : `${monthOf(first.month)} a ${end}`)
}

export function controlText(control: BookControl, isPlaying: boolean): ControlText {
  if (control === BookControl.Play) {
    return isPlaying ? PAUSE : PLAY
  }
  return textOf(CONTROLS, control)
}

// Above a page: its number; nothing above the cover or a blank page.
export function pageLabel(page: BookPage | undefined): string {
  return page?.kind === PageKind.Photos ? pageNumberText(page.number) : ''
}

// "Capa e página 1", "Páginas 2 e 3", "Página 7".
export function spreadText(spread: Spread): string {
  const numbers = [spread.left, spread.right]
    .filter((page): page is PhotoPage => page?.kind === PageKind.Photos)
    .map(({ number }) => String(number))
  const pages =
    numbers.length === 1 ? `página ${numbers.join('')}` : `páginas ${numbers.join(' e ')}`
  return spread.left.kind === PageKind.Cover
    ? `${MESSAGES.bookCover} e ${pages}`
    : capitalized(pages)
}
