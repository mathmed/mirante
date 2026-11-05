// The runtime APIs that Chromium 68 (LG's webOS) lacks and the bundle calls anyway:
// - Object.fromEntries (Chromium 73): the HTTP runtime of the Immich SDK merges request headers
//   with it;
// - queueMicrotask (Chromium 71): Preact schedules every render with it, so without it the app
//   stops at its first update (the grey screen of the LG).
// Installed by install-polyfills.ts, the first module the bundle runs. Two checks of `make build`
// let exactly these through: es-check (`ignore` in .escheckrc.json, by its feature names) and the
// API check of the bundle (`polyfilled` in .browser-apis.json); polyfills.test.ts keeps the lists
// equal.
export const POLYFILLED_FEATURES: readonly string[] = ['ObjectFromEntries']
export const POLYFILLED_APIS: readonly string[] = ['Object.fromEntries', 'queueMicrotask']

export function installPolyfills(): void {
  // Enumerable or not like the native ones: the methods of Object are not, those of window are.
  addMissing(Object, 'fromEntries', { value: fromEntries, enumerable: false })
  addMissing(window, 'queueMicrotask', { value: queueMicrotask, enumerable: true })
}

function addMissing(owner: object, name: string, descriptor: PropertyDescriptor): void {
  if (typeof Reflect.get(owner, name) === 'function') {
    return
  }
  Object.defineProperty(owner, name, { ...descriptor, writable: true, configurable: true })
}

export function fromEntries(entries: Iterable<readonly [PropertyKey, unknown]>): object {
  const result = {}
  for (const [key, value] of entries) {
    Object.defineProperty(result, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    })
  }
  return result
}

// Runs the callback in a microtask, like the native one. What the callback throws is reported as
// an uncaught error, from a task of its own, instead of becoming an unhandled rejection.
export function queueMicrotask(callback: VoidFunction): void {
  Promise.resolve()
    .then(callback)
    .catch((error: unknown) => {
      setTimeout(() => {
        throw error
      })
    })
}
