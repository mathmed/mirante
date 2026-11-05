// The .wgt of `make package-tizen`, run the way a Samsung Tizen TV runs it once signed and
// installed: unzipped, opened from file:// in Chromium (headless, here) with access to its own
// files, as Tizen's web runtime allows, with a tizen global that counts the calls to leave. The
// fake Immich answers CORS like the proxy in front of the owner's server. Needs `make build`
// first; `make test-tizen` runs both.
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
import { widgetVersionOf } from '../scripts/tizen/widget.ts'
import { readPng } from '../test/support/png.ts'
import { readZip, type ZipFile } from '../test/support/zip.ts'
import { type FakeImmich, startFakeImmich } from './fake-immich-server.ts'
import {
  expectBackToLeave,
  expectBrowsingAcrossOrigins,
  expectReportedUnreachable,
  launchBrowser,
  openApp,
  type OpenedApp,
  TvSystem,
} from './packaged-app.ts'

const ROOT = join(import.meta.dirname, '..')
const APP_ID = 'MirantTV01.Mirante'
const TIZEN_BACK = 10_009
const runProcess = promisify(execFile)

let immich: FakeImmich
let directory = ''
let files: readonly ZipFile[] = []
let indexUrl = ''
let browser: Browser

async function packageAgainst(immichUrl: string): Promise<string> {
  const out = join(directory, 'package')
  await runProcess(process.execPath, ['scripts/tizen.ts', 'package', '--out', out], {
    cwd: ROOT,
    env: { ...process.env, MIRANTE_IMMICH_URL: immichUrl },
  })
  return join(out, 'Mirante.wgt')
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
  return openApp(browser, indexUrl, { system: TvSystem.Tizen, isChromium68: false })
}

beforeAll(async () => {
  immich = await startFakeImmich()
  directory = await mkdtemp(join(tmpdir(), 'mirante-tizen-e2e-'))
  files = readZip(await readBytes(await packageAgainst(immich.url)))
  // Where the TV installs a widget: a folder of its package, with the files under res/wgt.
  const appFolder = join(directory, 'tv', 'MirantTV01', 'res', 'wgt')
  await unpack(appFolder)
  indexUrl = pathToFileURL(join(appFolder, 'index.html')).href
  browser = await launchBrowser()
})

afterAll(async () => {
  await browser.close()
  await immich.close()
  await rm(directory, { recursive: true, force: true })
})

describe('the Tizen package', () => {
  it('should hold the build, config.xml, config.json and the icon, unsigned, and nothing else', async () => {
    const build = await listFilesDeep(join(ROOT, 'dist'))

    expect(files.map((file) => file.path)).toStrictEqual(
      [...build, 'config.json', 'config.xml', 'icon.png'].toSorted(compareText),
    )
    const icon = readPng(
      files.find((file) => file.path === 'icon.png')?.content ?? new Uint8Array(),
    )
    expect([icon.width, icon.height]).toStrictEqual([117, 117])
    for (const file of build) {
      expect(fileText(file)).toBe(await readText(join(ROOT, 'dist', file)))
    }
  })

  it('should describe the widget at the version of package.json, with the full address and no key', async () => {
    const version = widgetVersionOf(await readText(join(ROOT, 'package.json')))
    const configXml = fileText('config.xml')

    expect(configXml).toContain(`<widget version="${version}" `)
    expect(configXml).toContain(
      `<tizen:application id="${APP_ID}" package="MirantTV01" required_version="6.5"/>`,
    )
    expect(configXml).toContain('<content src="index.html"/>')
    expect(configXml).toContain('<icon src="icon.png"/>')
    expect(configXml).toContain('<access origin="*" subdomains="true"/>')
    expect(JSON.parse(fileText('config.json'))).toStrictEqual({ immichUrl: immich.url })
  })

  it('should read the albums and load the images across origins from file://', async () => {
    immich.requests.length = 0
    const app = await open()

    await expectBrowsingAcrossOrigins(app, immich)
    await app.page.close()
  })

  it('should go back one screen, then leave the application on Back from the start screen', async () => {
    const app = await open()

    await expectBackToLeave(app, TIZEN_BACK)
    await app.page.close()
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
