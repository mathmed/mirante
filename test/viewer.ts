import { render } from '@testing-library/preact'
import { h } from 'preact'

import type { PhotoLibrary } from '../src/core/photo-library.ts'
import type { PresentationSettings } from '../src/core/presentation-settings.ts'
import { type Slide, slideOf } from '../src/core/presentation.ts'
import { type Rounds, SAME_SLIDES } from '../src/ui/use-presentation.ts'
import { Viewer } from '../src/ui/Viewer.tsx'
import { photos, stubLibrary } from './library-stub.ts'
import { presentationControls } from './presentation-controls.ts'
import { fakeRemote, type FakeRemote } from './remote.ts'

// The viewer of the component tests: five photos of March 2024 (p-1 to p-5), paused on the third,
// with the default settings, over a library without captions.
export const SLIDES: readonly Slide[] = photos('p', 5).map(slideOf)

export interface ViewerOptions {
  readonly start: number
  readonly slides: readonly Slide[]
  readonly shouldPlay: boolean
  readonly settings: Partial<PresentationSettings>
  readonly library: PhotoLibrary
  readonly rounds: Rounds
}

const DEFAULT_OPTIONS: ViewerOptions = {
  start: 2,
  slides: SLIDES,
  shouldPlay: false,
  settings: {},
  library: stubLibrary({ readCaption: async () => Promise.resolve(undefined) }),
  rounds: SAME_SLIDES,
}

export interface ShownViewer {
  readonly remote: FakeRemote
  readonly closed: number[]
  readonly saved: PresentationSettings[]
  readonly reported: unknown[]
}

export function showViewer(options: Partial<ViewerOptions> = {}): ShownViewer {
  const { start, slides, shouldPlay, settings, library, rounds } = {
    ...DEFAULT_OPTIONS,
    ...options,
  }
  const remote = fakeRemote()
  const closed: number[] = []
  const reported: unknown[] = []
  const { controls, saved } = presentationControls(settings)
  render(
    h(Viewer, {
      slides,
      start,
      shouldPlay,
      rounds,
      library,
      keys: remote.keys,
      reportError: (error) => reported.push(error),
      presentation: controls,
      onClose: (index) => closed.push(index),
    }),
  )
  return { remote, closed, saved, reported }
}

export function preview(id: string): string {
  return `https://images.test/preview/${id}`
}

// The previews in the page: the slides kept decoded.
export function decoded(): readonly (string | null)[] {
  return [...document.querySelectorAll('.slide img')].map((image) => image.getAttribute('src'))
}

export function current(): string | null | undefined {
  return document.querySelector('.slide.is-current img')?.getAttribute('src')
}
