import {
  ConfigProblem,
  type ConfigResult,
  invalidConfig,
  parseRuntimeConfig,
} from '../core/runtime-config.ts'

// Next to index.html: the packaged apps read it from their own folder, the browser from the server.
export const CONFIG_FILE = 'config.json'

const HTTP_OK = 200
const HTTP_NOT_FOUND = 404
// A file read from the file system (the packaged apps) answers with status 0.
const FILE_STATUS = 0
// A web server set up for single-page apps answers every unknown path with index.html.
const HTML_TYPE = 'text/html'

export interface FileResponse {
  readonly status: number
  readonly text: string
  readonly contentType: string | null
}

// XMLHttpRequest rather than fetch: the packaged apps load from file://, which Chromium's fetch
// refuses and XMLHttpRequest reads.
export async function readConfigFile(url: string): Promise<ConfigResult> {
  const response = await requestText(url)
  return response === undefined ? invalidConfig(ConfigProblem.Missing) : configFrom(response)
}

export function configFrom(response: FileResponse): ConfigResult {
  if (isMissing(response)) {
    return invalidConfig(ConfigProblem.Missing)
  }
  const { status, text } = response
  return isRead(status) ? parseRuntimeConfig(text) : invalidConfig(ConfigProblem.Unreadable)
}

function isMissing({ status, text, contentType }: FileResponse): boolean {
  const isPage = contentType?.includes(HTML_TYPE) === true
  return isPage || status === HTTP_NOT_FOUND || (status === FILE_STATUS && text === '')
}

function isRead(status: number): boolean {
  return status === HTTP_OK || status === FILE_STATUS
}

// Settles with the response, or undefined when the request fails before one (a missing local file).
async function requestText(url: string): Promise<FileResponse | undefined> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest()
    request.addEventListener('load', () => {
      resolve({
        status: request.status,
        text: request.responseText,
        contentType: request.getResponseHeader('Content-Type'),
      })
    })
    request.addEventListener('error', () => {
      resolve(undefined)
    })
    request.open('GET', url)
    request.setRequestHeader('Cache-Control', 'no-cache')
    request.send()
  })
}
