// Where the system of a webOS TV gives its web apps the call to leave: `PalmSystem` always, `webOS`
// when the app includes LG's webOSTV.js (Mirante does not). The app declares
// `disableBackHistoryAPI` in its appinfo.json, so the system leaves Back to the app, which calls
// platformBack on its first screen.
const SYSTEMS = ['webOS', 'PalmSystem'] as const
const PLATFORM_BACK = 'platformBack'

interface SystemBack {
  readonly platformBack: () => void
}

// Back to whatever ran before the app (the TV's launcher). A browser has no such call: the page
// stays, as the tab is not the app's to close.
export function leaveApp(host: object): void {
  const system = SYSTEMS.map((name): unknown => Reflect.get(host, name)).find(hasPlatformBack)
  system?.platformBack()
}

// The globals of the TV come from outside the app: checked before they are called.
function hasPlatformBack(value: unknown): value is SystemBack {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, PLATFORM_BACK) === 'function'
  )
}
