import type { LibraryEditor } from './library-editor.ts'
import { LoadFailure, loadFailureOf } from './loading.ts'
import type { PhotoLibrary, ServerInfo } from './photo-library.ts'
import type { PresentationSettings } from './presentation-settings.ts'
import {
  ConfigProblem,
  type ConfigResult,
  resolveImmichUrl,
  type RuntimeConfig,
} from './runtime-config.ts'

export const StartupFailure = {
  ...ConfigProblem,
  ...LoadFailure,
} as const

export type StartupFailure = (typeof StartupFailure)[keyof typeof StartupFailure]

export const StartupStatus = {
  Loading: 'loading',
  Connected: 'connected',
  Failed: 'failed',
} as const

// What the gallery needs once the server answered; the API key stays inside the library.
export interface Session {
  readonly server: ServerInfo
  readonly library: PhotoLibrary
  // The changes to the library, when the proxy allows them (the gallery asks the server first).
  readonly editor: LibraryEditor
  // The defaults of the presentations, from config.json; each TV keeps its own choices over them.
  readonly presentationDefaults: PresentationSettings
}

export type StartupState =
  | { readonly status: typeof StartupStatus.Loading }
  | { readonly status: typeof StartupStatus.Connected; readonly session: Session }
  | { readonly status: typeof StartupStatus.Failed; readonly failure: StartupFailure }

export type StartupOutcome = Exclude<StartupState, { readonly status: 'loading' }>

export interface StartupDependencies {
  readonly loadConfig: () => Promise<ConfigResult>
  // Where the page was served from: a relative immichUrl points there.
  readonly pageOrigin: string
  readonly openLibrary: (config: RuntimeConfig) => PhotoLibrary
  readonly openEditor: (config: RuntimeConfig) => LibraryEditor
  readonly reportError: (error: unknown) => void
}

export const LOADING: StartupState = { status: StartupStatus.Loading }

// Reads the runtime configuration, then asks the server who it is. Every failure becomes an outcome
// the UI can explain; the error behind it goes to the log.
export async function startUp(dependencies: StartupDependencies): Promise<StartupOutcome> {
  try {
    return await connect(dependencies)
  } catch (error) {
    dependencies.reportError(error)
    return failed(loadFailureOf(error))
  }
}

async function connect(dependencies: StartupDependencies): Promise<StartupOutcome> {
  const result = await dependencies.loadConfig()
  if (!result.isValid) {
    return failed(result.problem)
  }
  const config = resolveImmichUrl(result.config, dependencies.pageOrigin)
  const library = dependencies.openLibrary(config)
  const server = await library.describeServer()
  const editor = dependencies.openEditor(config)
  const session = { server, library, editor, presentationDefaults: config.presentation }
  return { status: StartupStatus.Connected, session }
}

function failed(failure: StartupFailure): StartupOutcome {
  return { status: StartupStatus.Failed, failure }
}
