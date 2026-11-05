// What the end-to-end tests of the TV packages share: the app unpacked and opened from file:// in a
// headless Chromium with access to its own files, as the web app runtimes of the TVs allow, the
// call each TV gives the app to leave, the keys of the remote control, and the checks every
// package must pass against the fake Immich behind the owner's proxy.
import { type Browser, chromium, type Page } from 'playwright'
import { expect } from 'vitest'

import { ALBUM_NAME, type FakeImmich, PHOTO_IDS } from './fake-immich-server.ts'
import { emulateChromium68 } from './legacy-chromium.ts'

// The TV whose system the page gets: webOS's PalmSystem or Tizen's tizen global.
export const TvSystem = { Webos: 'webos', Tizen: 'tizen' } as const
export type TvSystem = (typeof TvSystem)[keyof typeof TvSystem]

export interface Tv {
  readonly system: TvSystem
  // The Chromium 68 of the owner's LG, emulated (see legacy-chromium.ts); the Samsung runs 85.
  readonly isChromium68: boolean
}

export interface OpenedApp {
  readonly page: Page
  // How many times the app asked the TV to leave.
  readonly exits: () => Promise<number>
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ args: ['--allow-file-access-from-files'] })
}

export async function openApp(browser: Browser, indexUrl: string, tv: Tv): Promise<OpenedApp> {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  if (tv.isChromium68) {
    await emulateChromium68(page)
  }
  // Runs in the page, which does not see this module: the system arrives as its name.
  await page.addInitScript((name: TvSystem) => {
    let exits = 0
    const leave = (): void => {
      exits += 1
      Reflect.set(window, 'exits', exits)
    }
    Reflect.set(window, 'exits', exits)
    if (name === 'webos') {
      Reflect.set(window, 'PalmSystem', { platformBack: leave })
    } else {
      Reflect.set(window, 'tizen', {
        application: { getCurrentApplication: () => ({ exit: leave }) },
      })
    }
  }, tv.system)
  await page.goto(indexUrl)
  return {
    page,
    exits: async () => page.evaluate(() => (window as unknown as { exits: number }).exits),
  }
}

// A key of the remote control, as the TV's input sends it (Back has no key of a desktop keyboard).
async function pressKeyCode(page: Page, keyCode: number): Promise<void> {
  const session = await page.context().newCDPSession(page)
  for (const type of ['rawKeyDown', 'keyUp'] as const) {
    await session.send('Input.dispatchKeyEvent', {
      type,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
    })
  }
  await session.detach()
}

async function focusedText(page: Page): Promise<string> {
  return page.evaluate(() => document.activeElement?.textContent ?? '')
}

async function loadedImages(page: Page, size: string): Promise<number> {
  return page.evaluate(
    (asked) =>
      [...document.images].filter(
        (image) => image.complete && image.naturalWidth > 0 && image.src.includes(`size=${asked}`),
      ).length,
    size,
  )
}

// The albums, the thumbnails and a preview load from the proxy, another origin than file://.
export async function expectBrowsingAcrossOrigins(
  app: OpenedApp,
  immich: FakeImmich,
): Promise<void> {
  const { page } = app
  await page.getByText(`Immich 3.3.6 em ${immich.url.replace('http://', '')}`).waitFor()
  await page.keyboard.press('Enter')
  await page.getByText(ALBUM_NAME).waitFor()
  await expect.poll(async () => loadedImages(page, 'thumbnail')).toBe(1)
  await page.keyboard.press('Enter')
  await expect.poll(async () => loadedImages(page, 'thumbnail')).toBe(PHOTO_IDS.length)
  await page.keyboard.press('Enter')
  await page.getByRole('dialog', { name: `1 de ${String(PHOTO_IDS.length)}` }).waitFor()
  await expect.poll(async () => loadedImages(page, 'preview')).toBeGreaterThan(0)
  expectCrossOriginCalls(immich)
}

// fetch sends the origin of the page with each call (cross-origin, so in CORS mode); <img> loads
// without one. No request carries a key: the proxy adds it.
function expectCrossOriginCalls(immich: FakeImmich): void {
  const calls = immich.requests.filter((request) => !request.url.includes('/thumbnail'))
  expect(calls.map((request) => `${request.method} ${request.url.split('?')[0] ?? ''}`)).toContain(
    'GET /api/albums',
  )
  expect(calls.filter((request) => request.origin === undefined)).toStrictEqual([])
  expect(calls.map((request) => request.origin)).not.toContain(immich.url)
  expect(immich.requests.filter((request) => request.apiKey !== undefined)).toStrictEqual([])
  expect(immich.requests.map((request) => request.url)).toContain(
    `/api/assets/${PHOTO_IDS[0]}/thumbnail?size=preview`,
  )
}

// Back returns one screen, then asks the TV to leave from the start screen, once.
export async function expectBackToLeave(app: OpenedApp, backKeyCode: number): Promise<void> {
  const { page, exits } = app
  await expect.poll(async () => focusedText(page)).toBe('Álbuns')
  await page.keyboard.press('Enter')
  await expect.poll(async () => focusedText(page)).toContain(ALBUM_NAME)

  await pressKeyCode(page, backKeyCode)
  await expect.poll(async () => focusedText(page)).toBe('Álbuns')
  expect(await exits()).toBe(0)

  await pressKeyCode(page, backKeyCode)
  await expect.poll(exits).toBe(1)
}

// What a proxy that does not answer CORS looks like: an Immich that did not answer.
export async function expectReportedUnreachable(app: OpenedApp): Promise<void> {
  const alert = app.page.getByRole('alert')
  await alert.waitFor()
  expect(await alert.textContent()).toContain('O Immich não respondeu')
}
