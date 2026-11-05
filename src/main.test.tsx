import { screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { IMMICH_URL, serveConfig, serveImmich, VALID_CONFIG } from '../test/fake-immich.ts'
import { StartupFailure } from './core/startup.ts'
import { failureText } from './ui/messages.ts'

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('main', () => {
  it('should connect to the Immich server of config.json', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    serveConfig(VALID_CONFIG)
    serveImmich()

    await import('./main.tsx')

    expect(await screen.findByText(IMMICH_URL.replace('http://', ''))).toBeTruthy()
  })

  it('should explain a rejected API key and log why', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    serveConfig({ ...VALID_CONFIG, apiKey: 'revoked-key' })
    serveImmich()

    await import('./main.tsx')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(failureText(StartupFailure.KeyRejected).title)
    expect(log).toHaveBeenCalledOnce()
  })

  it('should refuse a page without the root element', async () => {
    await expect(import('./main.tsx')).rejects.toThrow('index.html has no #app element')
  })
})
