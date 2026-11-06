// Before anything else: see install-polyfills.ts.
import './platform/install-polyfills.ts'

import { render } from 'preact'

import { startUp } from './core/startup.ts'
import { createImmichLibrary } from './immich/immich-library.ts'
import { leaveApp } from './platform/app-exit.ts'
import { CONFIG_FILE, readConfigFile } from './platform/config-file.ts'
import { logError } from './platform/error-log.ts'
import { BOOK_SEEDS_KEY, localTextStorage, SETTINGS_KEY } from './platform/local-settings.ts'
import { randomSeed } from './platform/random-seed.ts'
import { listenToRemote } from './platform/remote-control.ts'
import { registerTizenKeys } from './platform/tizen-keys.ts'
import { App } from './ui/App.tsx'
import './ui/styles.css'

// After this long without an answer, the Immich server counts as unreachable.
const REQUEST_TIMEOUT_MS = 10_000
const ROOT_ID = 'app'

const root = document.getElementById(ROOT_ID)
if (root === null) {
  throw new Error(`index.html has no #${ROOT_ID} element`)
}

const configUrl = new URL(CONFIG_FILE, document.baseURI).href
registerTizenKeys(window, logError)
const keys = listenToRemote(document)

const start = async (): ReturnType<typeof startUp> =>
  startUp({
    loadConfig: async () => readConfigFile(configUrl),
    pageOrigin: window.location.origin,
    openLibrary: (config) => createImmichLibrary({ config, timeoutMs: REQUEST_TIMEOUT_MS }),
    reportError: logError,
  })

const leave = (): void => {
  leaveApp(window)
}

render(
  <App
    start={start}
    keys={keys}
    reportError={logError}
    leave={leave}
    storage={localTextStorage(window, SETTINGS_KEY)}
    bookStorage={localTextStorage(window, BOOK_SEEDS_KEY)}
    newSeed={randomSeed}
  />,
  root,
)
