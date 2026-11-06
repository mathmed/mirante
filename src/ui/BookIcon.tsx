import type { JSX } from 'preact'

// An open book, in lines, in the color of the text around it: the tile that opens the album or the
// month as a book.
export function BookIcon(): JSX.Element {
  return (
    <svg
      class="book-icon"
      viewBox="0 0 64 64"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="2.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M32 18c-6-4-14-5-22-4v34c8-1 16 0 22 4 6-4 14-5 22-4V14c-8-1-16 0-22 4Z" />
      <path d="M32 18v34" />
      <path d="M16 24h10M16 31h10M38 24h10M38 31h10" />
    </svg>
  )
}
