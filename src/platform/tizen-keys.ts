// Tizen hands an app the arrows, Enter and Back by itself, but any other key of the remote control
// only once the app registers it (tizen.tvinputdevice, with the tv.inputdevice privilege of
// tizen/config.xml). Mirante registers Info, which opens the settings over the viewer. Elsewhere
// there is no such API, and nothing happens.
const TIZEN = 'tizen'
const INPUT_DEVICE = 'tvinputdevice'
const REGISTER_KEY = 'registerKey'
const REGISTERED_KEYS: readonly string[] = ['Info']

export function registerTizenKeys(host: object, reportError: (error: unknown) => void): void {
  const tizen: unknown = Reflect.get(host, TIZEN)
  const inputDevice: unknown = isObject(tizen) ? Reflect.get(tizen, INPUT_DEVICE) : undefined
  const register: unknown = isObject(inputDevice)
    ? Reflect.get(inputDevice, REGISTER_KEY)
    : undefined
  if (typeof register !== 'function') {
    return
  }
  for (const key of REGISTERED_KEYS) {
    registerKey(() => Reflect.apply(register, inputDevice, [key]), reportError)
  }
}

// Best effort: without the key (a TV that refuses it), Down still opens the settings.
function registerKey(register: () => unknown, reportError: (error: unknown) => void): void {
  try {
    register()
  } catch (error) {
    reportError(error)
  }
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}
