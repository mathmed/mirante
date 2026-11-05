import type { JSX } from 'preact'

import { type HomeEntry, ScreenKind } from '../core/navigation.ts'

// The line icons of the start screen, drawn in the color of the text around them.
export interface HomeIconProps {
  readonly entry: HomeEntry
}

export function HomeIcon({ entry }: HomeIconProps): JSX.Element {
  return (
    <svg
      class="home-icon"
      viewBox="0 0 64 64"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="2.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {entry.kind === ScreenKind.Albums ? <AlbumsLines /> : <TimelineLines />}
    </svg>
  )
}

// Two frames, one behind the other, with a sun over the hills in the front one.
function AlbumsLines(): JSX.Element {
  return (
    <>
      <path d="M18 14V12a4 4 0 0 1 4-4h32a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4h-2" opacity="0.55" />
      <rect x="6" y="20" width="44" height="36" rx="4" />
      <circle cx="19" cy="31" r="3.5" />
      <path d="M10 50l12-11 8 7 6-5 10 9" />
    </>
  )
}

// A line through time, with the moments on it.
function TimelineLines(): JSX.Element {
  return (
    <>
      <path d="M4 32h56" />
      <circle cx="14" cy="32" r="4.5" />
      <circle cx="32" cy="32" r="4.5" fill="currentColor" />
      <circle cx="50" cy="32" r="4.5" />
      <path d="M14 26V14M32 38v12M50 26V14" opacity="0.55" />
    </>
  )
}
