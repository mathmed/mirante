import type { JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'

import { BOOK_CONTROLS, type BookFocus, BookZone } from '../core/book-navigation.ts'
import { controlText } from './book-messages.ts'

export interface BookBarProps {
  readonly focus: BookFocus
  readonly isPlaying: boolean
  // While the overview covers the bar, its button waits to take the focus back.
  readonly isCovered: boolean
}

// Under the spread: the arrows at the sides, the overview in the middle, and the buttons that play
// and reorganize the book.
export function BookBar({ focus, isPlaying, isCovered }: BookBarProps): JSX.Element {
  return (
    <ul class="book-bar">
      {BOOK_CONTROLS.map((control, index) => {
        const { text, label } = controlText(control, isPlaying)
        const isFocused = focus.zone === BookZone.Controls && focus.control === index
        return <BookButton key={control} {...{ text, label }} isFocused={isFocused && !isCovered} />
      })}
    </ul>
  )
}

interface BookButtonProps {
  readonly text: string
  readonly label: string
  readonly isFocused: boolean
}

// The button in focus holds the browser's focus, and takes it back when the overview closes.
function BookButton({ text, label, isFocused }: BookButtonProps): JSX.Element {
  const buttonRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (isFocused) {
      buttonRef.current?.focus({ preventScroll: true })
    }
  }, [isFocused])
  return (
    <li
      ref={buttonRef}
      class="book-control"
      tabIndex={-1}
      role="button"
      aria-label={label}
      aria-current={isFocused}
    >
      {text}
    </li>
  )
}
