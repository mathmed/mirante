// The screenshots of the docs (make screenshots): the build, opened from file:// in a headless
// Chromium at 1920x1080 (and the settings and the book at 1280x720 too) like the TV packages,
// against a fake Immich with a library of landscapes, walked with the remote control. Each screen
// is written to docs/screenshots/ as a WebP the page itself encodes, under 300 KB, for the owner to
// review the look of the app; and the icon of the app beside the two alternatives it was chosen
// against.
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Browser, Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { writeText } from '../scripts/shared/files.ts'
import { type FakeImmich, startFakeImmich } from './fake-immich-server.ts'
import { iconAlternativesPage } from './icon-alternatives.ts'
import { launchBrowser } from './packaged-app.ts'
import {
  BOOK_ALBUM,
  BOOK_PHOTO_IDS,
  EMPTY_ALBUM,
  SCREENSHOT_LIBRARY,
  screenshotImage,
} from './screenshot-library.ts'
import { focusedBox, focusedOn, press, progressed, settled, shoot } from './screenshot-page.ts'

const ROOT = join(import.meta.dirname, '..')
const VIEWPORT = { width: 1920, height: 1080 }
const SMALL_VIEWPORT = { width: 1280, height: 720 }
// The share of each edge a TV may hide.
const OVERSCAN = 0.05
const TO_THE_LAST_SETTING: readonly string[] = Array<string>(15).fill('ArrowDown')
// The opening shows the status under the logo after 1.2 s; the slow server answers after this.
const SLOW_START_MS = 6000
// How far the line of the slideshow has filled in its screenshot.
const SLIDESHOW_SHARE = 0.3
const BACK = 'Escape'
// The settings the TV keeps (localStorage, mirante.presentation), set before the app starts: the
// format of the book, and the controls kept on the screen long enough to be captured.
const SETTINGS_KEY = 'mirante.presentation'
const WIDE_SETTINGS = { bookFormat: 'wide', hideInterfaceSeconds: 20 }
const CLASSIC_SETTINGS = { bookFormat: 'classic', hideInterfaceSeconds: 20 }
// The day on the clock of the browser: the trip to Lisbon began on it, two years before, so that its
// photos take turns behind the start screen.
const TODAY = new Date(2026, 8, 12, 10)
// The photos of the book are drawn first, larger than the others.
const BOOK_TIMEOUT_MS = 180_000

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

async function open(viewport = VIEWPORT): Promise<Page> {
  const page = await browser.newPage({ viewport })
  await page.clock.setFixedTime(TODAY)
  await page.goto(indexUrl)
  return page
}

// The book of the waterfalls, on its cover, in a page that starts with these settings kept.
async function openBook(
  viewport: { readonly width: number; readonly height: number },
  settings: Readonly<Record<string, unknown>>,
): Promise<Page> {
  // Drawn before the book asks for them, the images never hold the captions behind them.
  for (const id of BOOK_PHOTO_IDS) {
    screenshotImage(id, 'thumbnail')
    screenshotImage(id, 'preview')
  }
  const page = await browser.newPage({ viewport })
  await page.addInitScript(
    ({ key, text }) => {
      window.localStorage.setItem(key, text)
    },
    { key: SETTINGS_KEY, text: JSON.stringify({ version: 1, settings }) },
  )
  await page.goto(indexUrl)
  await focusedOn(page, 'Todas')
  await press(page, 'ArrowRight', 'Enter')
  await focusedOn(page, 'Viagem a Lisboa')
  await press(page, 'ArrowDown', 'ArrowRight', 'ArrowRight')
  await focusedOn(page, BOOK_ALBUM)
  await press(page, 'Enter')
  await page.getByRole('heading', { level: 1, name: BOOK_ALBUM }).waitFor()
  await page.locator('.grid-photos').waitFor()
  await press(page, 'ArrowLeft')
  await focusedOn(page, 'Ver como livro')
  await press(page, 'Enter')
  await page.locator('.book-cover').waitFor()
  await page.getByText('O vale ainda na neblina, antes da trilha').waitFor()
  await settled(page)
  return page
}

// The second spread, a photo in focus, with nothing over it; then the controls over it.
async function shootSpread(page: Page, spread: string, controls: string): Promise<void> {
  await press(page, 'ArrowRight')
  await page.locator('.book-layer-pages', { hasText: 'Páginas 2 e 3' }).waitFor()
  await press(page, 'ArrowDown')
  await settled(page)
  await shoot(page, spread)

  await press(page, 'i')
  await page.locator('.book-layer.is-shown').waitFor()
  await focusedOn(page, 'Visão geral')
  await settled(page)
  await shoot(page, controls)
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

  it.each([
    ['19-ajustes-fim', VIEWPORT],
    ['20-ajustes-fim-720p', SMALL_VIEWPORT],
  ])('should capture the settings scrolled to their end (%s)', async (name, viewport) => {
    const page = await open(viewport)
    await focusedOn(page, 'Todas')
    await press(page, 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter')
    await focusedOn(page, 'Tempo de cada foto')

    await press(page, ...TO_THE_LAST_SETTING)
    await focusedOn(page, 'Restaurar padrões')
    await settled(page)

    const row = await focusedBox(page)
    expect(row.top).toBeGreaterThanOrEqual(viewport.height * OVERSCAN)
    expect(row.bottom).toBeLessThanOrEqual(viewport.height * (1 - OVERSCAN))
    await shoot(page, name)
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

  it(
    'should capture a book full screen: its cover, a spread, its controls and its overview',
    async () => {
      const page = await openBook(VIEWPORT, WIDE_SETTINGS)
      await shoot(page, '16-livro-capa')

      await shootSpread(page, '17-livro', '21-livro-controles')

      await press(page, 'Enter')
      await page.getByRole('dialog', { name: 'Visão geral' }).waitFor()
      await press(page, 'ArrowRight')
      await settled(page)
      await shoot(page, '18-livro-visao-geral')
      await page.close()
    },
    BOOK_TIMEOUT_MS,
  )

  it(
    'should capture a classic book, and its controls',
    async () => {
      const page = await openBook(VIEWPORT, CLASSIC_SETTINGS)
      await shootSpread(page, '22-livro-classico', '23-livro-classico-controles')
      await page.close()
    },
    BOOK_TIMEOUT_MS,
  )

  it(
    'should capture both books on a TV of 1280x720',
    async () => {
      const wide = await openBook(SMALL_VIEWPORT, WIDE_SETTINGS)
      await shootSpread(wide, '24-livro-720', '25-livro-controles-720')
      await wide.close()

      const classic = await openBook(SMALL_VIEWPORT, CLASSIC_SETTINGS)
      await shootSpread(classic, '26-livro-classico-720', '27-livro-classico-controles-720')
      await classic.close()
    },
    BOOK_TIMEOUT_MS,
  )

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
