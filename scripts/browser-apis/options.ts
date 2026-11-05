import browserslist from 'browserslist'

import { ARRAY, field, parseObject } from '../shared/json.ts'
import type { BrowserApisOptions } from './rule.ts'

export const CONFIG_FILE = '.browser-apis.json'

const CHROME = /^chrome (\d+)$/

// The options of the check: the oldest Chrome of the browserslist of the repository (package.json)
// and the APIs .browser-apis.json says the app polyfills.
export function browserApisOptions(root: string, config: unknown): BrowserApisOptions {
  return {
    chrome: oldestChrome(browserslist(undefined, { path: root })),
    polyfilled: polyfilledOf(config),
  }
}

export function oldestChrome(browsers: readonly string[]): number {
  const versions = browsers.flatMap((browser) => {
    const version = CHROME.exec(browser)?.[1]
    return version === undefined ? [] : [Number(version)]
  })
  if (versions.length === 0) {
    throw new TypeError(`the browserslist names no version of Chrome: ${browsers.join(', ')}`)
  }
  return Math.min(...versions)
}

function polyfilledOf(config: unknown): string[] {
  const polyfilled = field(parseObject(config), 'polyfilled', ARRAY)
  if (!polyfilled.every((api) => typeof api === 'string')) {
    throw new TypeError(`expected every API of "polyfilled" in ${CONFIG_FILE} to be a string`)
  }
  return [...polyfilled]
}
