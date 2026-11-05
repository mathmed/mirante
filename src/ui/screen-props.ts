import type { GridPosition } from '../core/grid.ts'
import type { Screen } from '../core/navigation.ts'
import type { PhotoLibrary } from '../core/photo-library.ts'
import type { PresentationSettings } from '../core/presentation-settings.ts'
import type { KeySource } from '../core/remote-key.ts'

// The settings of the presentations, kept by the gallery for the whole visit.
export interface PresentationControls {
  readonly settings: PresentationSettings
  // What "restore the defaults" goes back to: those of config.json, or the app's.
  readonly defaults: PresentationSettings
  // Applies the settings at once and keeps them on the TV.
  readonly saveSettings: (settings: PresentationSettings) => void
  // A new seed for each random order.
  readonly newSeed: () => number
}

// What every screen of the gallery receives.
export interface ScreenProps {
  readonly library: PhotoLibrary
  readonly keys: KeySource
  readonly reportError: (error: unknown) => void
  // Where the focus was when the screen was last left; the start for a new screen.
  readonly position: GridPosition
  readonly open: (from: GridPosition, screen: Screen) => void
  readonly back: () => void
  readonly presentation: PresentationControls
}
