import { fieldsOf, isRecord, parseJson } from './json.ts'
import {
  DEFAULT_PRESENTATION,
  INTERVAL_RANGE,
  type PresentationSettings,
  secondsWithin,
} from './presentation-settings.ts'
import { parsePresentation } from './settings-input.ts'

export interface RuntimeConfig {
  // An absolute http(s) address, or a path on the server of the page ('' for its root) when Mirante
  // is served from the same address as Immich, behind a proxy that sends /api to it.
  readonly immichUrl: string
  // Absent when that proxy adds the key to every request itself.
  readonly apiKey?: string
  // The defaults of the presentations: the app's, under the "presentation" block of the file.
  readonly presentation: PresentationSettings
}

export const ConfigProblem = {
  Missing: 'config-missing',
  Unreadable: 'config-unreadable',
  Malformed: 'config-malformed',
  InvalidImmichUrl: 'config-invalid-immich-url',
  InvalidApiKey: 'config-invalid-api-key',
  InvalidSlideshowSeconds: 'config-invalid-slideshow-seconds',
  InvalidPresentation: 'config-invalid-presentation',
} as const

export type ConfigProblem = (typeof ConfigProblem)[keyof typeof ConfigProblem]

export type ConfigResult =
  | { readonly isValid: true; readonly config: RuntimeConfig }
  | { readonly isValid: false; readonly problem: ConfigProblem }

export const MIN_SLIDESHOW_SECONDS = 3
export const MAX_SLIDESHOW_SECONDS = 3600

const SCHEME = /^https?:\/\//i
// Characters an address never has: blanks, and the start of a query or a fragment.
const FORBIDDEN_IN_ADDRESS = /[\s?#]/
const SLASH = '/'
const PROTOCOL_RELATIVE = '//'

interface KeyField {
  readonly apiKey?: string
}

export function invalidConfig(problem: ConfigProblem): ConfigResult {
  return { isValid: false, problem }
}

export function parseRuntimeConfig(text: string): ConfigResult {
  const json = parseJson(text)
  if (!isRecord(json)) {
    return invalidConfig(ConfigProblem.Malformed)
  }
  const immichUrl = parseImmichUrl(json['immichUrl'])
  if (immichUrl === undefined) {
    return invalidConfig(ConfigProblem.InvalidImmichUrl)
  }
  return withOptionalFields(immichUrl, json)
}

// The server as people know it: its host and port, without the scheme.
export function serverAddress(config: RuntimeConfig): string {
  return config.immichUrl.replace(SCHEME, '')
}

// A relative address points at the server that served the page: the proxy in front of Immich.
export function resolveImmichUrl(config: RuntimeConfig, pageOrigin: string): RuntimeConfig {
  return SCHEME.test(config.immichUrl)
    ? config
    : { ...config, immichUrl: `${pageOrigin}${config.immichUrl}` }
}

function withOptionalFields(
  immichUrl: string,
  json: Readonly<Record<string, unknown>>,
): ConfigResult {
  const keyField = parseApiKey(json['apiKey'])
  if (keyField === undefined) {
    return invalidConfig(ConfigProblem.InvalidApiKey)
  }
  const slideshowSeconds = parseSlideshowSeconds(json['slideshowSeconds'])
  if (slideshowSeconds === undefined) {
    return invalidConfig(ConfigProblem.InvalidSlideshowSeconds)
  }
  const presentation = presentationOf(json['presentation'], slideshowSeconds)
  if (presentation === undefined) {
    return invalidConfig(ConfigProblem.InvalidPresentation)
  }
  return { isValid: true, config: { immichUrl, presentation, ...keyField } }
}

// slideshowSeconds, the interval before the "presentation" block existed, still sets the default
// interval, within the limits of the setting; presentation.intervalSeconds wins over it.
function presentationOf(
  block: unknown,
  slideshowSeconds: number | null,
): PresentationSettings | undefined {
  const defaults =
    slideshowSeconds === null
      ? DEFAULT_PRESENTATION
      : {
          ...DEFAULT_PRESENTATION,
          intervalSeconds: secondsWithin(slideshowSeconds, INTERVAL_RANGE),
        }
  return block === undefined ? defaults : parsePresentation(fieldsOf(block), defaults)
}

// An absolute http(s) address with a host, an optional port and path, or a path that starts at the
// root of the page's server; no query or fragment, and without the slashes at its end.
function parseImmichUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const address = value.trim()
  const hostAndPath = address.replace(SCHEME, '')
  const isValid = hostAndPath === address ? isRootPath(address) : isHostAndPath(hostAndPath)
  return isValid ? withoutTrailingSlashes(address) : undefined
}

function isHostAndPath(text: string): boolean {
  return text !== '' && !text.startsWith(SLASH) && !FORBIDDEN_IN_ADDRESS.test(text)
}

function isRootPath(text: string): boolean {
  const isEmptyOrRooted = text === '' || text.startsWith(SLASH)
  return isEmptyOrRooted && !text.startsWith(PROTOCOL_RELATIVE) && !FORBIDDEN_IN_ADDRESS.test(text)
}

function withoutTrailingSlashes(address: string): string {
  let end = address.length
  while (address.endsWith(SLASH, end)) {
    end -= 1
  }
  return address.slice(0, end)
}

// No key (absent, null or blank) is valid: the proxy sends it. Anything but text is a mistake.
function parseApiKey(value: unknown): KeyField | undefined {
  if (value === undefined || value === null) {
    return {}
  }
  if (typeof value !== 'string') {
    return undefined
  }
  const key = value.trim()
  return key === '' ? {} : { apiKey: key }
}

// null when the file leaves it out.
function parseSlideshowSeconds(value: unknown): number | null | undefined {
  if (value === undefined) {
    return null
  }
  const isInRange =
    typeof value === 'number' && value >= MIN_SLIDESHOW_SECONDS && value <= MAX_SLIDESHOW_SECONDS
  return isInRange ? value : undefined
}
