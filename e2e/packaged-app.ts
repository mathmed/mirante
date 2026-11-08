// What the end-to-end tests of the TV packages share: the app unpacked and opened from file:// in a
// headless Chromium with access to its own files, as the web app runtimes of the TVs allow, the
// call each TV gives the app to leave, the keys of the remote control, and the checks every
// package must pass against the fake Immich behind the owner's proxy.
import { type Browser, chromium, type Page } from 'playwright'
import { expect } from 'vitest'

import { ALBUM_ID, ALBUM_NAME, CAPTION, type FakeImmich, PHOTO_IDS } from './fake-immich-server.ts'
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
  await expect.poll(async () => focusedText(page)).toBe('Todas')
  await page.keyboard.press('ArrowRight')
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

// The whole library, drawn at random by Immich (a POST with a JSON body, so after a preflight that
// lets Content-Type through), playing at once with the caption of its first photo.
export async function expectLibraryPresentation(app: OpenedApp, immich: FakeImmich): Promise<void> {
  const { page } = app
  await expect.poll(async () => focusedText(page)).toBe('Todas')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect.poll(async () => focusedText(page)).toContain('Toda a biblioteca')
  await page.keyboard.press('Enter')
  await page.getByRole('dialog', { name: `1 de ${String(PHOTO_IDS.length)}` }).waitFor()
  await page.getByText(CAPTION).waitFor()
  const calls = immich.requests.map((request) => `${request.method} ${request.url}`)
  expect(calls).toContain('OPTIONS /api/search/random')
  expect(calls).toContain('POST /api/search/random')
  expect(calls).toContain(`GET /api/assets/${PHOTO_IDS[0]}`)
}

// Every photo, the most recent first under the heading of its month, read from the timeline across
// origins; the viewer opens on the photo in focus and gives the focus back to it.
export async function expectEveryPhoto(app: OpenedApp, immich: FakeImmich): Promise<void> {
  const { page } = app
  await expect.poll(async () => focusedText(page)).toBe('Todas')
  await page.keyboard.press('Enter')
  await page.getByRole('heading', { level: 2, name: 'Março de 2024' }).waitFor()
  await expect.poll(async () => loadedImages(page, 'thumbnail')).toBe(PHOTO_IDS.length)
  await page.keyboard.press('Enter')
  await page.getByRole('dialog', { name: `1 de ${String(PHOTO_IDS.length)}` }).waitFor()
  await expect.poll(async () => loadedImages(page, 'preview')).toBeGreaterThan(0)
  await page.keyboard.press('Escape')
  await expect.poll(async () => loadedImages(page, 'thumbnail')).toBe(PHOTO_IDS.length)
  const calls = immich.requests.map((request) => `${request.method} ${request.url}`)
  expect(calls).toContain('GET /api/timeline/buckets?visibility=timeline')
  expect(calls).toContain('GET /api/timeline/bucket?timeBucket=2024-03-01&visibility=timeline')
  expect(immich.requests.map((request) => request.url)).toContain(
    `/api/assets/${PHOTO_IDS[1]}/thumbnail?size=preview`,
  )
}

// Back returns one screen, then asks the TV to leave from the start screen, once.
export async function expectBackToLeave(app: OpenedApp, backKeyCode: number): Promise<void> {
  const { page, exits } = app
  await expect.poll(async () => focusedText(page)).toBe('Todas')
  await page.keyboard.press('ArrowRight')
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

// The permissions of the key of the changes docs/proxy.md asks for.
export const WRITE_PERMISSIONS = [
  'asset.delete',
  'album.create',
  'album.update',
  'album.delete',
  'albumAsset.create',
  'albumAsset.delete',
]

// The changes the app asked for, with their bodies, as they reached the proxy.
function changesSent(immich: FakeImmich): readonly string[] {
  return immich.requests
    .filter((request) => !['GET', 'OPTIONS'].includes(request.method))
    .filter(
      (request) => !request.url.startsWith('/api/search') && !request.url.includes('validateToken'),
    )
    .map((request) => `${request.method} ${request.url} ${request.body}`.trim())
}

async function thumbnailsShown(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('.grid-photos img').length)
}

// With the key of the changes on the proxy: a photo of the album selected and sent to the trash
// after a confirmation, then back; the album renamed with the keyboard (an "i" and a Backspace
// typed into the field, not taken for Info and Back); the photo of the viewer added to a new album.
// Each change crosses origins after its preflight, with the exact body Immich takes, and no key.
export async function expectManagement(
  app: OpenedApp,
  immich: FakeImmich,
  backKeyCode: number,
): Promise<void> {
  const { page } = app
  await openAlbumToManage(page)
  await trashAndUndo(page, immich, backKeyCode)
  await renameAlbum(page, immich)
  await addToNewAlbum(page, immich)
  expect(changesSent(immich)).toStrictEqual([
    `DELETE /api/assets {"ids":["${PHOTO_IDS[0]}"],"force":false}`,
    `POST /api/trash/restore/assets {"ids":["${PHOTO_IDS[0]}"]}`,
    `PATCH /api/albums/${ALBUM_ID} {"albumName":"Lisboa"}`,
    `POST /api/albums {"albumName":"Março de 2024","assetIds":["${PHOTO_IDS[0]}"]}`,
  ])
  const calls = immich.requests.map((request) => `${request.method} ${request.url}`)
  expect(calls).toContain('OPTIONS /api/assets')
  expect(calls).toContain(`OPTIONS /api/albums/${ALBUM_ID}`)
  expect(immich.requests.filter((request) => request.apiKey !== undefined)).toStrictEqual([])
}

async function openAlbumToManage(page: Page): Promise<void> {
  await expect.poll(async () => focusedText(page)).toBe('Todas')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect.poll(async () => focusedText(page)).toBe('+Novo álbum')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect.poll(async () => thumbnailsShown(page)).toBe(PHOTO_IDS.length)
}

async function trashAndUndo(page: Page, immich: FakeImmich, backKeyCode: number): Promise<void> {
  await page.keyboard.press('ArrowUp')
  await expect.poll(async () => focusedText(page)).toBe('Selecionar')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await expect.poll(async () => page.locator('.tile-mark').count()).toBe(1)
  await pressKeyCode(page, backKeyCode)
  await expect.poll(async () => focusedText(page)).toBe('Adicionar ao álbum')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await page.getByRole('dialog', { name: 'Apagar esta foto?' }).waitFor()
  await expect.poll(async () => focusedText(page)).toBe('Cancelar')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect.poll(async () => thumbnailsShown(page)).toBe(1)
  await page.getByText('1 foto foi para a lixeira do Immich · ↑ Desfazer').waitFor()
  await page.keyboard.press('ArrowUp')
  await expect.poll(async () => focusedText(page)).toBe('Desfazer')
  await page.keyboard.press('Enter')
  await expect.poll(async () => thumbnailsShown(page)).toBe(PHOTO_IDS.length)
  expect(immich.requests.map((request) => request.method)).toContain('DELETE')
}

async function renameAlbum(page: Page, immich: FakeImmich): Promise<void> {
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => focusedText(page)).toBe('Renomear álbum')
  await page.keyboard.press('Enter')
  await page.getByRole('dialog', { name: 'Novo nome do álbum' }).waitFor()
  // The field takes the focus, its name selected: what is typed takes its place.
  await expect.poll(async () => page.evaluate(() => document.activeElement?.tagName)).toBe('INPUT')
  await page.keyboard.type('Lisboaa')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Enter')
  await page.getByRole('heading', { level: 1, name: 'Lisboa', exact: true }).waitFor()
  await expect.poll(() => changesSent(immich).length).toBe(3)
}

async function addToNewAlbum(page: Page, immich: FakeImmich): Promise<void> {
  await page.keyboard.press('Enter')
  await page.getByRole('dialog', { name: `1 de ${String(PHOTO_IDS.length)}` }).waitFor()
  await page.keyboard.press('ArrowUp')
  await expect.poll(async () => focusedText(page)).toBe('Adicionar ao álbum')
  await page.keyboard.press('Enter')
  await expect.poll(async () => focusedText(page)).toBe('Novo álbum')
  await page.keyboard.press('Enter')
  await expect.poll(async () => focusedText(page)).toBe('Criar')
  await page.keyboard.press('Enter')
  await page.getByText('Álbum “Março de 2024” criado com 1 foto').waitFor()
  await expect.poll(() => changesSent(immich).length).toBe(4)
}

// Without the key of the changes on the proxy: no new album, no bar, and Up on a photo says why.
export async function expectReadOnly(app: OpenedApp, immich: FakeImmich): Promise<void> {
  const { page } = app
  await expect.poll(async () => focusedText(page)).toBe('Todas')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect.poll(async () => focusedText(page)).toContain(ALBUM_NAME)
  await page.keyboard.press('Enter')
  await expect.poll(async () => thumbnailsShown(page)).toBe(PHOTO_IDS.length)
  expect(await page.locator('.action-bar').count()).toBe(0)
  await page.keyboard.press('ArrowUp')
  await page
    .getByText('Este Mirante só mostra as fotos: o proxy não tem a chave de escrita do Immich.')
    .waitFor()
  const calls = immich.requests.map((request) => `${request.method} ${request.url}`)
  expect(calls).toContain('GET /api/api-keys/me')
  expect(calls).not.toContain('GET /api/server/features')
  expect(changesSent(immich)).toStrictEqual([])
}
