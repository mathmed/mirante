// The .ipk of `make package-webos`, run the way a webOS TV runs it: unpacked, opened from file://
// in Chromium (headless, here) with access to its own files, as LG's web app runtime allows. The
// fake Immich answers CORS like the proxy in front of the owner's server. Needs `make build`
// first; `make test-webos` runs both.
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { type Browser, chromium, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { listFilesDeep, readBytes, readText, writeBytes } from '../scripts/shared/files.ts'
import { compareText } from '../scripts/shared/text.ts'
import { versionOf } from '../scripts/webos/appinfo.ts'
import { appFiles, type ArchiveFile, ipkFiles } from '../scripts/webos/ipk.ts'
import { readPng } from '../test/support/png.ts'
import { ALBUM_NAME, type FakeImmich, PHOTO_IDS, startFakeImmich } from './fake-immich-server.ts'

const ROOT = join(import.meta.dirname, '..')
const APP_ID = 'com.mathmed.mirante'
const WEBOS_BACK = 461
const runProcess = promisify(execFile)

let immich: FakeImmich
let directory = ''
let files: readonly ArchiveFile[] = []
let indexUrl = ''
let browser: Browser

async function packageAgainst(immichUrl: string): Promise<string> {
  const out = join(directory, 'package')
  await runProcess(process.execPath, ['scripts/webos.ts', 'package', '--out', out], {
    cwd: ROOT,
    env: { ...process.env, MIRANTE_IMMICH_URL: immichUrl },
  })
  return join(out, `${APP_ID}_${await packageVersion()}_all.ipk`)
}

async function packageVersion(): Promise<string> {
  return versionOf(await readText(join(ROOT, 'package.json')))
}

async function unpack(appFolder: string): Promise<void> {
  for (const file of files) {
    await writeBytes(join(appFolder, file.path), file.content)
  }
}

function fileText(path: string): string {
  return Buffer.from(files.find((file) => file.path === path)?.content ?? []).toString()
}

async function openApp(): Promise<{ readonly page: Page; readonly exits: () => Promise<number> }> {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  // What the system of the TV gives the app; platformBack counts the times it is asked to leave.
  await page.addInitScript(() => {
    let exits = 0
    Reflect.set(window, 'exits', exits)
    Reflect.set(window, 'PalmSystem', {
      platformBack: () => {
        exits += 1
        Reflect.set(window, 'exits', exits)
      },
    })
  })
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

beforeAll(async () => {
  immich = await startFakeImmich()
  directory = await mkdtemp(join(tmpdir(), 'mirante-webos-e2e-'))
  const ipkPath = await packageAgainst(immich.url)
  files = appFiles(ipkFiles(await readBytes(ipkPath)), APP_ID)
  const appFolder = join(directory, 'tv', APP_ID)
  await unpack(appFolder)
  indexUrl = pathToFileURL(join(appFolder, 'index.html')).href
  browser = await chromium.launch({ args: ['--allow-file-access-from-files'] })
})

afterAll(async () => {
  await browser.close()
  await immich.close()
  await rm(directory, { recursive: true, force: true })
})

describe('the webOS package', () => {
  it('should hold the build, appinfo.json, config.json and the icons, and nothing else', async () => {
    const build = await listFilesDeep(join(ROOT, 'dist'))

    expect(files.map((file) => file.path).toSorted(compareText)).toStrictEqual(
      [...build, 'appinfo.json', 'config.json', 'icon.png', 'largeIcon.png'].toSorted(compareText),
    )
    const icon = readPng(
      files.find((file) => file.path === 'icon.png')?.content ?? new Uint8Array(),
    )
    const largeIcon = readPng(
      files.find((file) => file.path === 'largeIcon.png')?.content ?? new Uint8Array(),
    )
    expect([icon.width, icon.height, largeIcon.width, largeIcon.height]).toStrictEqual([
      80, 80, 130, 130,
    ])
  })

  it('should describe the app at the version of package.json, with the full address and no key', async () => {
    const { version } = JSON.parse(await readText(join(ROOT, 'package.json'))) as {
      version: string
    }

    expect(JSON.parse(fileText('appinfo.json'))).toMatchObject({
      id: APP_ID,
      title: 'Mirante',
      type: 'web',
      main: 'index.html',
      icon: 'icon.png',
      largeIcon: 'largeIcon.png',
      disableBackHistoryAPI: true,
      version,
    })
    expect(JSON.parse(fileText('config.json'))).toStrictEqual({ immichUrl: immich.url })
  })

  it('should read the albums and load the images across origins from file://', async () => {
    immich.requests.length = 0
    const { page } = await openApp()
    await page.getByText(`Immich 3.3.6 em ${immich.url.replace('http://', '')}`).waitFor()

    await page.keyboard.press('Enter')
    await page.getByText(ALBUM_NAME).waitFor()
    await expect.poll(async () => loadedImages(page, 'thumbnail')).toBe(1)
    await page.keyboard.press('Enter')
    await expect.poll(async () => loadedImages(page, 'thumbnail')).toBe(PHOTO_IDS.length)
    await page.keyboard.press('Enter')
    await page.getByRole('dialog', { name: `1 de ${String(PHOTO_IDS.length)}` }).waitFor()
    await expect.poll(async () => loadedImages(page, 'preview')).toBeGreaterThan(0)

    // fetch sends the origin of the page with each call (cross-origin, so in CORS mode); <img>
    // loads without one.
    const calls = immich.requests.filter((request) => !request.url.includes('/thumbnail'))
    expect(
      calls.map((request) => `${request.method} ${request.url.split('?')[0] ?? ''}`),
    ).toContain('GET /api/albums')
    expect(calls.filter((request) => request.origin === undefined)).toStrictEqual([])
    expect(calls.map((request) => request.origin)).not.toContain(immich.url)
    expect(immich.requests.filter((request) => request.apiKey !== undefined)).toStrictEqual([])
    expect(immich.requests.map((request) => request.url)).toContain(
      `/api/assets/${PHOTO_IDS[0]}/thumbnail?size=preview`,
    )
    await page.close()
  })

  it('should go back one screen, then ask the TV to leave on Back from the start screen', async () => {
    const { page, exits } = await openApp()
    await expect.poll(async () => focusedText(page)).toBe('Álbuns')
    await page.keyboard.press('Enter')
    await expect.poll(async () => focusedText(page)).toContain(ALBUM_NAME)

    await pressKeyCode(page, WEBOS_BACK)
    await expect.poll(async () => focusedText(page)).toBe('Álbuns')
    expect(await exits()).toBe(0)

    await pressKeyCode(page, WEBOS_BACK)
    await expect.poll(exits).toBe(1)
    await page.close()
  })

  it('should not reach an Immich that does not answer CORS', async () => {
    immich.isCorsAllowed = false
    try {
      const { page } = await openApp()
      const alert = page.getByRole('alert')
      await alert.waitFor()
      expect(await alert.textContent()).toContain('O Immich não respondeu')
      await page.close()
    } finally {
      immich.isCorsAllowed = true
    }
  })
})
