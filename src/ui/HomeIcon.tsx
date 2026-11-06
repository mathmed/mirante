import type { JSX } from 'preact'

import { ScreenKind } from '../core/navigation.ts'

// The line icons of the start screen, by the screen each card opens: one line of 2 on a grid of
// 24, with round ends and corners, drawn in the color of the text around them (amber on the
// focused card).
export interface HomeIconProps {
  readonly kind: ScreenKind
}

export function HomeIcon({ kind }: HomeIconProps): JSX.Element {
  return (
    <svg
      class="home-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <Lines kind={kind} />
    </svg>
  )
}

function Lines({ kind }: HomeIconProps): JSX.Element {
  switch (kind) {
    case ScreenKind.AllPhotos:
      return <AllPhotosLines />
    case ScreenKind.Albums:
      return <AlbumsLines />
    case ScreenKind.Years:
      return <TimelineLines />
    case ScreenKind.Present:
      return <PresentLines />
    default:
      return <SettingsLines />
  }
}

// A grid of photos, the first one lit.
function AllPhotosLines(): JSX.Element {
  return (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="currentColor" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </>
  )
}

// A photo, with a sun over a hill, and the edge of another one behind it.
function AlbumsLines(): JSX.Element {
  return (
    <>
      <path d="M7 3.5h11.5A2.5 2.5 0 0 1 21 6v10" />
      <rect x="3" y="7" width="14" height="14" rx="2.5" />
      <circle cx="8" cy="12" r="1.5" />
      <path d="M3 18.5l4.5-4 3 2.5 2-1.5 4.5 3.5" />
    </>
  )
}

// A page of the calendar, its rings on top and one day marked.
function TimelineLines(): JSX.Element {
  return (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <rect x="13.5" y="13.5" width="4" height="4" rx="1" fill="currentColor" />
    </>
  )
}

// A screen on its stand, with the sign of play.
function PresentLines(): JSX.Element {
  return (
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
      <path d="M10 8.5l4.5 2.5-4.5 2.5z" />
      <path d="M8.5 21h7" />
    </>
  )
}

// Three sliders, each set to its own value.
function SettingsLines(): JSX.Element {
  return (
    <>
      <path d="M3 6h18M3 12h18M3 18h18" />
      <circle cx="8" cy="6" r="2" fill="currentColor" />
      <circle cx="16" cy="12" r="2" fill="currentColor" />
      <circle cx="11" cy="18" r="2" fill="currentColor" />
    </>
  )
}
