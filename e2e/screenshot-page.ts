// What the screenshots of the docs do with a page: press keys, wait for it to settle, and write
// it to docs/screenshots/ as a WebP.
import { join } from 'node:path'

import type { Page } from 'playwright'
import { expect } from 'vitest'

import { writeBytes } from '../scripts/shared/files.ts'

const SCREENSHOTS = join(import.meta.dirname, '..', 'docs', 'screenshots')
const MAX_BYTES = 300_000
const WEBP_QUALITY = 0.8
// The fake server draws each landscape when it is first asked for.
const POLL_MS = 30_000

export async function press(page: Page, ...keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key)
  }
}

// Every image on the page loaded, and every fade and growth over (the endless breathing of the
// mark while a screen waits aside).
export async function settled(page: Page): Promise<void> {
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
export async function progressed(page: Page, share: number): Promise<void> {
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

export async function focusedOn(page: Page, text: string): Promise<void> {
  await expect
    .poll(async () => page.evaluate(() => document.activeElement?.textContent ?? ''), {
      timeout: POLL_MS,
    })
    .toContain(text)
}

// Playwright only writes PNG or JPEG: the page draws the PNG on a canvas and encodes it as WebP.
export async function shoot(page: Page, name: string): Promise<void> {
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

// Where the element in focus is on the page.
export async function focusedBox(
  page: Page,
): Promise<{ readonly top: number; readonly bottom: number }> {
  const box = await page.evaluate(
    () => document.activeElement?.getBoundingClientRect().toJSON() as unknown,
  )
  if (typeof box !== 'object' || box === null || !('top' in box) || !('bottom' in box)) {
    throw new Error('Nothing is focused')
  }
  return { top: Number(box.top), bottom: Number(box.bottom) }
}

// The second spread, a photo in focus, with nothing over it; then the controls over it.
export async function shootSpread(page: Page, spread: string, controls: string): Promise<void> {
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
