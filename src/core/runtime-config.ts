export interface RuntimeConfig {
  readonly immichUrl: string
  readonly apiKey: string
}

export const ConfigProblem = {
  Missing: 'config-missing',
  Unreadable: 'config-unreadable',
  Malformed: 'config-malformed',
  InvalidImmichUrl: 'config-invalid-immich-url',
  InvalidApiKey: 'config-invalid-api-key',
} as const

export type ConfigProblem = (typeof ConfigProblem)[keyof typeof ConfigProblem]

export type ConfigResult =
  | { readonly isValid: true; readonly config: RuntimeConfig }
  | { readonly isValid: false; readonly problem: ConfigProblem }

const SCHEME = /^https?:\/\//i
// Characters an address never has: blanks, and the start of a query or a fragment.
const FORBIDDEN_IN_ADDRESS = /[\s?#]/
const SLASH = '/'

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
  const key = parseApiKey(json['apiKey'])
  if (key === undefined) {
    return invalidConfig(ConfigProblem.InvalidApiKey)
  }
  return { isValid: true, config: { immichUrl, apiKey: key } }
}

// The server as people know it: its host and port, without the scheme.
export function serverAddress(config: RuntimeConfig): string {
  return config.immichUrl.replace(SCHEME, '')
}

// An absolute http(s) address with a host, an optional port and path, and no query or fragment;
// without the slashes at its end.
function parseImmichUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const address = value.trim()
  const hostAndPath = address.replace(SCHEME, '')
  const hasScheme = hostAndPath !== address
  return hasScheme && isHostAndPath(hostAndPath) ? withoutTrailingSlashes(address) : undefined
}

function isHostAndPath(text: string): boolean {
  return text !== '' && !text.startsWith(SLASH) && !FORBIDDEN_IN_ADDRESS.test(text)
}

function withoutTrailingSlashes(address: string): string {
  let end = address.length
  while (address.endsWith(SLASH, end)) {
    end -= 1
  }
  return address.slice(0, end)
}

function parseApiKey(value: unknown): string | undefined {
  const key = typeof value === 'string' ? value.trim() : ''
  return key === '' ? undefined : key
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined
    }
    throw error
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
