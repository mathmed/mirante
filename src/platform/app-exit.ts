// How the system of each TV lets its web apps leave. On webOS: `PalmSystem.platformBack` always,
// `webOS.platformBack` when the app includes LG's webOSTV.js (Mirante does not); the app declares
// `disableBackHistoryAPI` in its appinfo.json, so the system leaves Back to the app. On Tizen:
// `tizen.application.getCurrentApplication().exit()`, which needs no privilege; Back (10009) always
// reaches the app. Both are called on the first screen.
const WEBOS_SYSTEMS = ['webOS', 'PalmSystem'] as const
const PLATFORM_BACK = 'platformBack'
const TIZEN = 'tizen'
const TIZEN_APPLICATION = 'application'
const CURRENT_APPLICATION = 'getCurrentApplication'
const EXIT = 'exit'

type Leave = () => unknown

// Back to whatever ran before the app (the TV's launcher). A browser has none of these calls: the
// page stays, as the tab is not the app's to close.
export function leaveApp(host: object): void {
  const leave = webOsBack(host) ?? tizenExit(host)
  leave?.()
}

function webOsBack(host: object): Leave | undefined {
  return WEBOS_SYSTEMS.map((name) => methodOf(Reflect.get(host, name), PLATFORM_BACK)).find(
    (method) => method !== undefined,
  )
}

// The application is only asked for when the app leaves.
function tizenExit(host: object): Leave | undefined {
  const tizen: unknown = Reflect.get(host, TIZEN)
  const application: unknown = isObject(tizen) ? Reflect.get(tizen, TIZEN_APPLICATION) : undefined
  const current = methodOf(application, CURRENT_APPLICATION)
  if (current === undefined) {
    return undefined
  }
  return () => methodOf(current(), EXIT)?.()
}

// The globals of the TV come from outside the app: checked before they are called, on the object
// they belong to.
function methodOf(owner: unknown, name: string): Leave | undefined {
  if (!isObject(owner)) {
    return undefined
  }
  const method: unknown = Reflect.get(owner, name)
  return typeof method === 'function' ? (): unknown => Reflect.apply(method, owner, []) : undefined
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}
