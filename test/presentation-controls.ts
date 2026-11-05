import {
  DEFAULT_PRESENTATION,
  type PresentationSettings,
} from '../src/core/presentation-settings.ts'
import type { PresentationControls } from '../src/ui/screen-props.ts'

// The settings of the presentations for the tests of the components: what the gallery would keep,
// with every save recorded.
export interface RecordedControls {
  readonly controls: PresentationControls
  readonly saved: PresentationSettings[]
}

export function presentationControls(
  settings: Partial<PresentationSettings> = {},
  defaults: PresentationSettings = DEFAULT_PRESENTATION,
): RecordedControls {
  const saved: PresentationSettings[] = []
  return {
    saved,
    controls: {
      settings: { ...DEFAULT_PRESENTATION, ...settings },
      defaults,
      saveSettings: (changed) => {
        saved.push(changed)
      },
      newSeed: () => 1,
    },
  }
}
