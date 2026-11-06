// The screenshots of the docs (make screenshots): the build, opened from file:// in a headless
// Chromium at 1920x1080 like the TV packages, against a fake Immich with a library of landscapes,
// walked with the remote control. Each screen is written to docs/screenshots/ as a WebP the page
// itself encodes, under 300 KB, for the owner to review the look of the app; and the icon of the
// app beside the two alternatives it was chosen against.
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Browser, Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { writeBytes, writeText } from '../scripts/shared/files.ts'
import { type FakeImmich, startFakeImmich } from './fake-immich-server.ts'
import { iconAlternativesPage } from './icon-alternatives.ts'
import { launchBrowser } from './packaged-app.ts'
import { EMPTY_ALBUM, SCREENSHOT_LIBRARY, screenshotImage } from './screenshot-library.ts'

const ROOT = join(import.meta.dirname, '..')
const SCREENSHOTS = join(ROOT, 'docs', 'screenshots')
const VIEWPORT = { width: 1920, height: 1080 }
const MAX_BYTES = 300_000
const WEBP_QUALITY = 0.8
// The opening shows the status under the logo after 1.2 s; the slow server answers after this.
const SLOW_START_MS = 6000
// How far the line of the slideshow has filled in its screenshot.
const SLIDESHOW_SHARE = 0.3
const BACK = 'Escape'
// The fake server draws each landscape when it is first asked for.
const POLL_MS = 30_000

let immich: FakeImmich
let directory = ''
let indexUrl = ''
let browser: Browser

beforeAll(async () => {
  immich = await startFakeImmich({ library: SCREENSHOT_LIBRARY, image: screenshotImage })
  directory = await mkdtemp(join(tmpdir(), 'mirante-screenshots-'))
  await cp(join(ROOT, 'dist'), join(directory, 'app'), { recursive: true })
  await writeText(join(directory, 'app', 'config.json'), JSON.stringify({ immichUrl: immich.url }))
  indexUrl = pathToFileURL(join(directory, 'app', 'index.html')).href
  browser = await launchBrowser()
})

afterAll(async () => {
  await browser.close()
  await immich.close()
  await rm(directory, { recursive: true, force: true })
})

async function open(): Promise<Page> {
  const page = await browser.newPage({ viewport: VIEWPORT })
  await page.goto(indexUrl)
  return page
}

async function press(page: Page, ...keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key)
  }
}

// Every image on the page loaded, and every fade and growth over (the endless breathing of the
// mark while a screen waits aside).
async function settled(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const isLoaded = [...document.images].every((image) => image.complete)
          const isStill = document
            .getAnimations()
            .every(
              (animation) =>
                animation.playState !== 'running' ||
                animation.effect?.getComputedTiming().iterations === Infinity,
            )
          return isLoaded && isStill
        }),
      { timeout: POLL_MS },
    )
    .toBe(true)
}

// The line of the slideshow filled this far.
async function progressed(page: Page, share: number): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const bar = document.querySelector('.viewer-progress-bar')
          return bar === null ? 0 : new DOMMatrix(getComputedStyle(bar).transform).a
        }),
      { timeout: POLL_MS },
    )
    .toBeGreaterThan(share)
}

async function focusedOn(page: Page, text: string): Promise<void> {
  await expect
    .poll(async () => page.evaluate(() => document.activeElement?.textContent ?? ''), {
      timeout: POLL_MS,
    })
    .toContain(text)
}

// Playwright only writes PNG or JPEG: the page draws the PNG on a canvas and encodes it as WebP.
async function shoot(page: Page, name: string): Promise<void> {
  const png = await page.screenshot()
  const dataUrl = await page.evaluate(
    async ({ base64, quality }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${base64}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      canvas.getContext('2d')?.drawImage(image, 0, 0)
      return canvas.toDataURL('image/webp', quality)
    },
    { base64: png.toString('base64'), quality: WEBP_QUALITY },
  )
  expect(dataUrl.startsWith('data:image/webp;base64,')).toBe(true)
  const webp = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
  expect(webp.length).toBeLessThan(MAX_BYTES)
  await writeBytes(join(SCREENSHOTS, `${name}.webp`), webp)
}

describe('the screenshots of the docs', () => {
  it('should capture the opening while the server is slow', async () => {
    immich.delaysMs.set('GET /api/server/version', SLOW_START_MS)
    try {
      const page = await open()
      await page.getByRole('status').waitFor()
      await settled(page)
      await shoot(page, '01-abertura')
      await page.close()
    } finally {
      immich.delaysMs.clear()
    }
  })

  it('should capture the start screen, the albums, an album and its photos', async () => {
    const page = await open()
    await focusedOn(page, 'Todas')
    await page.locator('.backdrop.is-shown').waitFor()
    await page.locator('.home-summary').waitFor()
    await settled(page)
    await shoot(page, '02-inicio')

    await press(page, 'ArrowRight', 'Enter')
    await focusedOn(page, 'Viagem a Lisboa')
    await settled(page)
    await shoot(page, '03-albuns')

    await press(page, 'Enter')
    await page.getByRole('heading', { level: 1, name: 'Viagem a Lisboa' }).waitFor()
    await page.locator('.grid-photos').waitFor()
    await press(page, 'ArrowRight', 'ArrowRight', 'ArrowDown')
    await settled(page)
    await shoot(page, '04-album')

    await press(page, 'Enter')
    await page.getByRole('dialog').waitFor()
    await settled(page)
    // The next photo is loaded ahead: it shows at once, with its date, its counter and its caption.
    await press(page, 'ArrowRight')
    await page.getByText('Fim de tarde no Miradouro de Santa Luzia').waitFor()
    await settled(page)
    await shoot(page, '05-foto')

    await press(page, 'Enter')
    await progressed(page, SLIDESHOW_SHARE)
    await shoot(page, '06-apresentacao')
    await page.close()
  })

  it('should capture the choices of a presentation and its settings', async () => {
    const page = await open()
    await focusedOn(page, 'Todas')
    await page.locator('.backdrop.is-shown').waitFor()

    await press(page, 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter')
    await focusedOn(page, 'Toda a biblioteca')
    await settled(page)
    await shoot(page, '12-apresentar')

    await press(page, BACK, 'ArrowRight', 'Enter')
    await focusedOn(page, 'Tempo de cada foto')
    await press(page, 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight')
    await focusedOn(page, 'Zoom lento')
    await settled(page)
    await shoot(page, '13-ajustes')
    await page.close()
  })

  it('should capture the settings over a photo', async () => {
    const page = await open()
    await focusedOn(page, 'Todas')
    await press(page, 'ArrowRight', 'Enter')
    await focusedOn(page, 'Viagem a Lisboa')
    await press(page, 'Enter')
    await page.getByRole('heading', { level: 1, name: 'Viagem a Lisboa' }).waitFor()
    await page.locator('.grid-photos').waitFor()
    await press(page, 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'Enter')
    await page.getByText('Fim de tarde no Miradouro de Santa Luzia').waitFor()

    await press(page, 'i')
    await focusedOn(page, 'Tempo de cada foto')
    await settled(page)
    await shoot(page, '14-ajustes-na-foto')
    await page.close()
  })

  it('should capture the timeline by year and by month', async () => {
    const page = await open()
    await focusedOn(page, 'Todas')

    await press(page, 'ArrowRight', 'ArrowRight', 'Enter')
    await focusedOn(page, '2024')
    await settled(page)
    await shoot(page, '07-linha-do-tempo')

    await press(page, 'Enter')
    await page.getByRole('heading', { level: 1, name: '2024' }).waitFor()
    await press(page, 'ArrowRight')
    await settled(page)
    await shoot(page, '08-meses')
    await page.close()
  })

  it('should capture every photo, a month under the other', async () => {
    const page = await open()
    await focusedOn(page, 'Todas')

    await press(page, 'Enter')
    await page.getByRole('heading', { level: 1, name: 'Todas as fotos' }).waitFor()
    await page.locator('.feed-month').first().waitFor()
    await press(page, 'ArrowDown', 'ArrowRight')
    await settled(page)
    await shoot(page, '15-todas')
    await page.close()
  })

  it('should capture an empty album', async () => {
    const page = await open()
    await focusedOn(page, 'Todas')

    await press(page, 'ArrowRight', 'Enter')
    await focusedOn(page, 'Viagem a Lisboa')
    await press(page, 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight')
    await focusedOn(page, EMPTY_ALBUM)
    await press(page, 'Enter')
    await page.getByRole('button', { name: 'Voltar' }).waitFor()
    await settled(page)
    await shoot(page, '09-album-vazio')
    await press(page, BACK)
    await page.close()
  })

  it('should capture a screen while the library is slow', async () => {
    immich.delaysMs.set('GET /api/albums', SLOW_START_MS)
    try {
      const page = await open()
      await focusedOn(page, 'Todas')
      await press(page, 'ArrowRight', 'Enter')
      await page.getByRole('status').waitFor()
      await settled(page)
      await shoot(page, '10-carregando')
      await page.close()
    } finally {
      immich.delaysMs.clear()
    }
  })

  it('should capture the explanation of a server that does not answer', async () => {
    immich.isCorsAllowed = false
    try {
      const page = await open()
      await page.getByRole('alert').waitFor()
      await settled(page)
      await shoot(page, '11-erro')
      await page.close()
    } finally {
      immich.isCorsAllowed = true
    }
  })

  it('should capture the icon of the app beside its two alternatives', async () => {
    const page = await browser.newPage({ viewport: VIEWPORT })
    await page.setContent(await iconAlternativesPage())
    await page.evaluate(async () => document.fonts.ready)
    await settled(page)
    await shoot(page, 'icone-alternativas')
    await page.close()
  })
})
