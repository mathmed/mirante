// The Chromium of the owner's LG (webOS, Chromium 68), as far as the app can tell from inside a
// recent headless Chromium:
// - the files of the app arrive without a MIME type, as webOS serves file://, so the browser
//   refuses a module script ("Failed to load module script: ... MIME type of ''") and runs a
//   classic one;
// - the APIs Chromium 68 lacks and src/platform/polyfills.ts adds (.browser-apis.json:
//   queueMicrotask, Object.fromEntries) are removed before any script of the page runs.
import { fileURLToPath } from 'node:url'

import type { CDPSession, Page } from 'playwright'

import browserApis from '../.browser-apis.json' with { type: 'json' }
import { readBytes } from '../scripts/shared/files.ts'

export const MODULE_REFUSED = 'Failed to load module script'

export const MISSING_APIS: readonly string[] = browserApis.polyfilled

export async function emulateChromium68(page: Page): Promise<void> {
  await serveScriptsWithoutType(page)
  // Runs in the page, before its scripts: `queueMicrotask` is window.queueMicrotask, and
  // `Object.fromEntries` the fromEntries of window.Object.
  await page.addInitScript((apis: readonly string[]) => {
    for (const api of apis) {
      const path = api.split('.')
      const name = path.pop() ?? ''
      const owner = path.reduce<object>((object, key) => Reflect.get(object, key) as object, window)
      Reflect.deleteProperty(owner, name)
    }
  }, MISSING_APIS)
}

// The APIs of MISSING_APIS the page has now, and which of them are the engine's own.
export async function nativeApis(page: Page): Promise<string[]> {
  return page.evaluate(
    (apis) =>
      apis.filter((api) => {
        const value: unknown = api
          .split('.')
          .reduce<unknown>((object, key) => Reflect.get(object as object, key), window)
        return typeof value !== 'function' || String(value).includes('[native code]')
      }),
    MISSING_APIS,
  )
}

async function serveScriptsWithoutType(page: Page): Promise<void> {
  const session = await page.context().newCDPSession(page)
  session.on('Fetch.requestPaused', ({ requestId, request }) => {
    fulfillWithoutType(session, requestId, request.url).catch((error: unknown) => {
      console.error(`Could not serve ${request.url}:`, error)
    })
  })
  await session.send('Fetch.enable', {
    patterns: [{ urlPattern: 'file://*', resourceType: 'Script', requestStage: 'Request' }],
  })
}

async function fulfillWithoutType(
  session: CDPSession,
  requestId: string,
  url: string,
): Promise<void> {
  const body = Buffer.from(await readBytes(fileURLToPath(url))).toString('base64')
  await session.send('Fetch.fulfillRequest', {
    requestId,
    responseCode: 200,
    responseHeaders: [],
    body,
  })
}
