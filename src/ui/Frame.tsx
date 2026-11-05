import type { ComponentChildren, JSX } from 'preact'

import { shortText } from './messages.ts'

// What fits on one line of the title, across the screen.
const TITLE_LENGTH = 56

export interface FrameProps {
  readonly title: string
  readonly children: ComponentChildren
}

// A screen of the gallery: its title and its content, inside the margins the TVs may hide.
export function Frame({ title, children }: FrameProps): JSX.Element {
  return (
    <main class="screen">
      <h1 class="screen-title">{shortText(title, TITLE_LENGTH)}</h1>
      {children}
    </main>
  )
}
