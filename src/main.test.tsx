import { fireEvent, screen, waitFor } from '@testing-library/preact'
import { render } from 'preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  IMMICH_URL,
  PAGE_ORIGIN,
  serveConfig,
  serveImmich,
  serveLibrary,
  VALID_CONFIG,
} from '../test/fake-immich.ts'
import { SAMPLE_LIBRARY, TRIP, TRIP_PHOTOS } from '../test/sample-library.ts'
import { StartupFailure } from './core/startup.ts'
import { failureText, MESSAGES } from './ui/messages.ts'

// The key codes the TVs send.
const KEY = { enter: 13, left: 37, up: 38, right: 39, down: 40, tizenBack: 10009, webOsBack: 461 }
const ESCAPE = 27
const BACKSPACE = 8

function press(...codes: readonly number[]): void {
  for (const keyCode of codes) {
    fireEvent.keyDown(document.activeElement ?? document.body, { keyCode })
  }
}

async function focusedOn(text: string): Promise<void> {
  await waitFor(() => {
    expect(document.activeElement?.textContent).toContain(text)
  })
}

async function title(text: string): Promise<void> {
  await screen.findByRole('heading', { level: 1, name: text })
}

function sources(): (string | null)[] {
  return [...document.querySelectorAll('img')].map((image) => image.getAttribute('src'))
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  const root = document.getElementById('app')
  if (root !== null) {
    render(null, root)
  }
  document.body.innerHTML = ''
})

async function start(): Promise<void> {
  document.body.innerHTML = '<div id="app"></div>'
  await import('./main.tsx')
}

describe('main', () => {
  it('should connect to the Immich server of config.json', async () => {
    serveConfig(VALID_CONFIG)
    serveImmich()

    await start()

    expect(
      await screen.findByText(`Immich 3.3.6 em ${IMMICH_URL.replace('http://', '')}`),
    ).toBeTruthy()
  })

  it('should explain a rejected API key and log why', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    serveConfig({ ...VALID_CONFIG, apiKey: 'revoked-key' })
    serveImmich()

    await start()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(failureText(StartupFailure.KeyRejected).title)
    expect(log).toHaveBeenCalledOnce()
  })

  it('should explain that no key reached Immich when the proxy does not add it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    serveConfig({ immichUrl: '' })
    serveImmich({ url: PAGE_ORIGIN })

    await start()

    expect((await screen.findByRole('alert')).textContent).toContain(
      failureText(StartupFailure.KeyMissing).title,
    )
  })

  it('should refuse a page without the root element', async () => {
    await expect(import('./main.tsx')).rejects.toThrow('index.html has no #app element')
  })

  it('should browse an album behind a proxy that adds the key, with the remote control', async () => {
    serveConfig({ immichUrl: '' })
    serveLibrary(SAMPLE_LIBRARY, { url: PAGE_ORIGIN, isKeyAdded: true })
    await start()
    expect(await screen.findByText('Immich 3.3.6 em localhost:3000')).toBeTruthy()
    await focusedOn(MESSAGES.albums)

    press(KEY.enter)
    await focusedOn(TRIP.name)
    expect(document.activeElement?.textContent).toContain(`${String(TRIP_PHOTOS + 1)} fotos`)
    press(KEY.enter)
    await title(TRIP.name)
    await waitFor(() => {
      expect(sources()).toHaveLength(TRIP_PHOTOS)
    })
    expect(sources()[0]).toBe(`${PAGE_ORIGIN}/api/assets/trip-00/thumbnail?size=thumbnail`)

    press(KEY.down, KEY.enter)
    expect(await screen.findByRole('dialog', { name: `7 de ${String(TRIP_PHOTOS)}` })).toBeTruthy()
    expect(sources()).toContain(`${PAGE_ORIGIN}/api/assets/trip-06/thumbnail?size=preview`)
    press(KEY.right, KEY.tizenBack)
    await waitFor(() => {
      expect(document.activeElement?.querySelector('img')?.getAttribute('src')).toBe(
        `${PAGE_ORIGIN}/api/assets/trip-07/thumbnail?size=thumbnail`,
      )
    })

    press(KEY.webOsBack)
    await focusedOn(TRIP.name)
    press(ESCAPE)
    await focusedOn(MESSAGES.albums)
  })

  it('should read every photo from an absolute immichUrl without a key, as the packaged app does', async () => {
    serveConfig({ immichUrl: `${IMMICH_URL}/` })
    serveLibrary(SAMPLE_LIBRARY, { isKeyAdded: true })
    await start()
    expect(await screen.findByText('Immich 3.3.6 em immich.test')).toBeTruthy()

    press(KEY.enter)
    await focusedOn(TRIP.name)
    press(KEY.enter)
    await waitFor(() => {
      expect(sources()).toHaveLength(TRIP_PHOTOS)
    })
    expect(sources()[0]).toBe(`${IMMICH_URL}/api/assets/trip-00/thumbnail?size=thumbnail`)
    press(KEY.enter)

    expect(await screen.findByRole('dialog', { name: `1 de ${String(TRIP_PHOTOS)}` })).toBeTruthy()
    expect(sources()).toContain(`${IMMICH_URL}/api/assets/trip-00/thumbnail?size=preview`)
  })

  it('should go back to the launcher on Back from the start screen of a webOS TV', async () => {
    const platformBack = vi.fn<() => void>()
    vi.stubGlobal('PalmSystem', { platformBack })
    serveConfig(VALID_CONFIG)
    serveImmich()
    await start()
    await focusedOn(MESSAGES.albums)

    press(KEY.webOsBack)

    expect(platformBack).toHaveBeenCalledOnce()
  })

  it('should leave the app on Back from the start screen of a Tizen TV', async () => {
    const exit = vi.fn<() => void>()
    vi.stubGlobal('tizen', { application: { getCurrentApplication: () => ({ exit }) } })
    serveConfig(VALID_CONFIG)
    serveLibrary(SAMPLE_LIBRARY)
    await start()
    await focusedOn(MESSAGES.albums)
    press(KEY.enter)
    await focusedOn(TRIP.name)

    press(KEY.tizenBack)
    await focusedOn(MESSAGES.albums)
    expect(exit).not.toHaveBeenCalled()
    press(KEY.tizenBack)

    expect(exit).toHaveBeenCalledOnce()
  })

  it('should stay on the start screen on Back in a browser', async () => {
    serveConfig(VALID_CONFIG)
    serveImmich()
    await start()
    await focusedOn(MESSAGES.albums)

    press(ESCAPE)

    await focusedOn(MESSAGES.albums)
    expect(screen.getByRole('heading', { level: 1, name: MESSAGES.appName })).toBeTruthy()
  })

  it('should walk the timeline by year and month with the remote control', async () => {
    serveConfig(VALID_CONFIG)
    serveLibrary(SAMPLE_LIBRARY)
    await start()
    await focusedOn(MESSAGES.albums)

    press(KEY.right, KEY.enter)
    await focusedOn('2024')
    press(KEY.enter)
    await focusedOn('Março')
    press(KEY.right, KEY.left, KEY.enter)
    await title('Março de 2024')
    await waitFor(() => {
      expect(sources()).toHaveLength(8)
    })

    press(BACKSPACE, BACKSPACE)
    await focusedOn('2024')
    press(KEY.down, KEY.right, KEY.enter)
    await title('2023')
    press(KEY.enter)

    await title('Dezembro de 2023')
    await waitFor(() => {
      expect(sources()).toStrictEqual([
        `${IMMICH_URL}/api/assets/family-dinner/thumbnail?size=thumbnail`,
      ])
    })
  })
})
