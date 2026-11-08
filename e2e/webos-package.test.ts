// The .ipk of `make package-webos`, run the way a webOS TV runs it: unpacked, opened from file://
// in Chromium (headless, here) with access to its own files, as LG's web app runtime allows, and
// made to look like the Chromium 68 of the owner's LG (legacy-chromium.ts): module scripts refused,
// queueMicrotask and Object.fromEntries missing. The fake Immich answers CORS like the proxy in
// front of the owner's server. Needs `make build`
// first (its webOS build, build/webos-dist/); `make test-webos` runs both.
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import type { Browser } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { listFilesDeep, readBytes, readText, writeBytes } from '../scripts/shared/files.ts'
import { compareText } from '../scripts/shared/text.ts'
import { versionOf } from '../scripts/webos/appinfo.ts'
import { appFiles, type ArchiveFile, ipkFiles } from '../scripts/webos/ipk.ts'
import { WEBOS_BUILD } from '../scripts/webos/package.ts'
import { readPng } from '../test/support/png.ts'
import { type FakeImmich, startFakeImmich } from './fake-immich-server.ts'
import { emulateChromium68, MISSING_APIS, MODULE_REFUSED, nativeApis } from './legacy-chromium.ts'
import {
  expectBackToLeave,
  expectBrowsingAcrossOrigins,
  expectEveryPhoto,
  expectLibraryPresentation,
  expectManagement,
  expectReadOnly,
  expectReportedUnreachable,
  launchBrowser,
  openApp,
  type OpenedApp,
  TvSystem,
  WRITE_PERMISSIONS,
} from './packaged-app.ts'

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

async function open(): Promise<OpenedApp> {
  return openApp(browser, indexUrl, { system: TvSystem.Webos, isChromium68: true })
}

beforeAll(async () => {
  immich = await startFakeImmich()
  directory = await mkdtemp(join(tmpdir(), 'mirante-webos-e2e-'))
  const ipkPath = await packageAgainst(immich.url)
  files = appFiles(ipkFiles(await readBytes(ipkPath)), APP_ID)
  const appFolder = join(directory, 'tv', APP_ID)
  await unpack(appFolder)
  indexUrl = pathToFileURL(join(appFolder, 'index.html')).href
  browser = await launchBrowser()
})

afterAll(async () => {
  await browser.close()
  await immich.close()
  await rm(directory, { recursive: true, force: true })
})

describe('the webOS package', () => {
  it('should hold the build, appinfo.json, config.json and the icons, and nothing else', async () => {
    const build = await listFilesDeep(join(ROOT, WEBOS_BUILD))

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

  it('should load the app as one classic script, without modules', () => {
    const html = fileText('index.html')

    expect(html).toMatch(/<script defer src="\.\/assets\/index-[\w-]+\.js"><\/script>/)
    expect(html).toMatch(/<link rel="stylesheet" href="\.\/assets\/style-[\w-]+\.css">/)
    for (const mark of ['type="module"', 'crossorigin', 'modulepreload']) {
      expect(html).not.toContain(mark)
    }
  })

  it('should start where module scripts are refused and the polyfilled APIs are missing', async () => {
    const app = await open()

    await app.page.getByText('Álbuns').waitFor()
    expect(MISSING_APIS).toStrictEqual(['Object.fromEntries', 'queueMicrotask'])
    expect(await nativeApis(app.page)).toStrictEqual([])
    await app.page.close()
  })

  it('should reproduce the grey screen of the LG with the web build, a module script', async () => {
    const page = await browser.newPage()
    await emulateChromium68(page)
    const refused = page.waitForEvent('console', (message) =>
      message.text().includes(MODULE_REFUSED),
    )

    await page.goto(pathToFileURL(join(ROOT, 'dist', 'index.html')).href)

    await refused
    expect(await page.locator('#app').innerHTML()).toBe('')
    await page.close()
  })

  it('should read the albums and load the images across origins from file://', async () => {
    immich.requests.length = 0
    const app = await open()

    await expectBrowsingAcrossOrigins(app, immich)
    await app.page.close()
  })

  it('should show every photo, the most recent first, read month by month across origins', async () => {
    immich.requests.length = 0
    const app = await open()

    await expectEveryPhoto(app, immich)
    await app.page.close()
  })

  it('should present the whole library, drawn at random across origins, with its captions', async () => {
    immich.requests.length = 0
    const app = await open()

    await expectLibraryPresentation(app, immich)
    await app.page.close()
  })

  it('should go back one screen, then ask the TV to leave on Back from the start screen', async () => {
    const app = await open()

    await expectBackToLeave(app, WEBOS_BACK)
    await app.page.close()
  })

  it('should change nothing, and say why, when the proxy holds no key for the changes', async () => {
    immich.requests.length = 0
    const app = await open()

    await expectReadOnly(app, immich)
    await app.page.close()
  })

  it('should delete, restore and add photos and rename an album with the remote control', async () => {
    immich.requests.length = 0
    immich.grantWrites(WRITE_PERMISSIONS)
    try {
      const app = await open()

      await expectManagement(app, immich, WEBOS_BACK)
      await app.page.close()
    } finally {
      immich.grantWrites(undefined)
    }
  })

  it('should not reach an Immich that does not answer CORS', async () => {
    immich.isCorsAllowed = false
    try {
      const app = await open()

      await expectReportedUnreachable(app)
      await app.page.close()
    } finally {
      immich.isCorsAllowed = true
    }
  })
})
