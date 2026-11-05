import {
  LibraryFailure,
  type PhotoLibrary,
  PhotoLibraryError,
  type ServerInfo,
} from './photo-library.ts'
import { ConfigProblem, type ConfigResult, type RuntimeConfig } from './runtime-config.ts'

export const StartupFailure = {
  ...ConfigProblem,
  ...LibraryFailure,
  Unexpected: 'unexpected',
} as const

export type StartupFailure = (typeof StartupFailure)[keyof typeof StartupFailure]

export const StartupStatus = {
  Loading: 'loading',
  Connected: 'connected',
  Failed: 'failed',
} as const

export type StartupState =
  | { readonly status: typeof StartupStatus.Loading }
  | { readonly status: typeof StartupStatus.Connected; readonly server: ServerInfo }
  | { readonly status: typeof StartupStatus.Failed; readonly failure: StartupFailure }

export type StartupOutcome = Exclude<StartupState, { readonly status: 'loading' }>

export interface StartupDependencies {
  readonly loadConfig: () => Promise<ConfigResult>
  readonly openLibrary: (config: RuntimeConfig) => PhotoLibrary
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
    return failed(error instanceof PhotoLibraryError ? error.failure : StartupFailure.Unexpected)
  }
}

async function connect(dependencies: StartupDependencies): Promise<StartupOutcome> {
  const result = await dependencies.loadConfig()
  if (!result.isValid) {
    return failed(result.problem)
  }
  const server = await dependencies.openLibrary(result.config).describeServer()
  return { status: StartupStatus.Connected, server }
}

function failed(failure: StartupFailure): StartupOutcome {
  return { status: StartupStatus.Failed, failure }
}
