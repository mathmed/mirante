import type { ComponentChildren, JSX } from 'preact'

import { Mark } from './Logo.tsx'
import { shortText } from './messages.ts'

// What fits on one line of the title, beside the mark.
const TITLE_LENGTH = 48

export interface FrameProps {
  readonly title: string
  readonly children: ComponentChildren
}

// A screen of the gallery: its title, the mark of the app and its content, inside the margins the
// TVs may hide.
export function Frame({ title, children }: FrameProps): JSX.Element {
  return (
    <main class="screen">
      <header class="screen-header">
        <h1 class="screen-title">{shortText(title, TITLE_LENGTH)}</h1>
        <Mark class="screen-mark" />
      </header>
      {children}
    </main>
  )
}
