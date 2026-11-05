import { render } from 'preact'

import { startUp } from './core/startup.ts'
import { createImmichLibrary } from './immich/immich-library.ts'
import { CONFIG_FILE, readConfigFile } from './platform/config-file.ts'
import { logError } from './platform/error-log.ts'
import { installPolyfills } from './platform/polyfills.ts'
import { listenToRemote } from './platform/remote-control.ts'
import { App } from './ui/App.tsx'
import './ui/styles.css'

// After this long without an answer, the Immich server counts as unreachable.
const REQUEST_TIMEOUT_MS = 10_000
const ROOT_ID = 'app'

installPolyfills()

const root = document.getElementById(ROOT_ID)
if (root === null) {
  throw new Error(`index.html has no #${ROOT_ID} element`)
}

const configUrl = new URL(CONFIG_FILE, document.baseURI).href
const keys = listenToRemote(document)

const start = async (): ReturnType<typeof startUp> =>
  startUp({
    loadConfig: async () => readConfigFile(configUrl),
    pageOrigin: window.location.origin,
    openLibrary: (config) => createImmichLibrary({ config, timeoutMs: REQUEST_TIMEOUT_MS }),
    reportError: logError,
  })

render(<App start={start} keys={keys} reportError={logError} />, root)
