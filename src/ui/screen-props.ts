import type { GridPosition } from '../core/grid.ts'
import type { Screen } from '../core/navigation.ts'
import type { PhotoLibrary } from '../core/photo-library.ts'
import type { KeySource } from '../core/remote-key.ts'

// What every screen of the gallery receives.
export interface ScreenProps {
  readonly library: PhotoLibrary
  readonly keys: KeySource
  readonly reportError: (error: unknown) => void
  // Where the focus was when the screen was last left; the start for a new screen.
  readonly position: GridPosition
  readonly open: (from: GridPosition, screen: Screen) => void
  readonly back: () => void
}
