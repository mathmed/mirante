// Built-ins that Chromium 68 (webOS) lacks and a dependency calls anyway: the HTTP runtime of the
// Immich SDK merges request headers with Object.fromEntries (Chromium 73). `make build` lets
// es-check skip exactly these features (`ignore` in .escheckrc.json); polyfills.test.ts keeps both
// lists equal.
export const POLYFILLED_FEATURES: readonly string[] = ['ObjectFromEntries']

export function installPolyfills(): void {
  const native: unknown = Reflect.get(Object, 'fromEntries')
  if (typeof native !== 'function') {
    Object.defineProperty(Object, 'fromEntries', {
      value: fromEntries,
      writable: true,
      configurable: true,
    })
  }
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
