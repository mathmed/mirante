import { jsonObjectOf } from './json-file.ts'
import { PackagingError } from './packaging-error.ts'

const IMMICH_URL_VARIABLE = 'MIRANTE_IMMICH_URL'
const CONFIG_FILE = 'config.json'
const EXAMPLE_FILE = 'config.example.json'

// The apps installed on the TVs load from the file system, not from the proxy in front of Immich:
// only a full address reaches the proxy, which answers CORS and adds the key.
const SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:'])
// What an address never has, as the app reads it: blanks, and the start of a query or a fragment.
const FORBIDDEN_IN_ADDRESS = /[\s?#]/
const INDENT = 2

export interface ConfigSources {
  // The folder of the TV's files in the repository (webos, tizen), where its config.json goes.
  readonly folder: string
  // The address of MIRANTE_IMMICH_URL, when it is set.
  readonly immichUrl: string | undefined
  // The text of the folder's config.json, when it exists.
  readonly fileText: string | undefined
}

// Where the configuration of the package is read from, by its path from the root of the repository.
export function configSourceFile(folder: string): string {
  return `${folder}/${CONFIG_FILE}`
}

// The config.json of the package: MIRANTE_IMMICH_URL alone when it is set, else the folder's
// config.json. The app checks every field again when it starts; the packaging refuses what would
// never work on the TV, and the API key, which would travel inside the package to anyone who gets it.
export function packagedConfig(sources: ConfigSources): string {
  const config = configOf(sources)
  checkImmichUrl(config.get('immichUrl'))
  if (config.has('apiKey')) {
    throw new PackagingError(
      `Tire o apiKey do ${configSourceFile(sources.folder)}: o app empacotado não leva a chave de API, quem a envia ao Immich é o proxy.`,
    )
  }
  return `${JSON.stringify(Object.fromEntries(config), null, INDENT)}\n`
}

function configOf({ folder, immichUrl, fileText }: ConfigSources): ReadonlyMap<string, unknown> {
  const address = immichUrl?.trim()
  if (address !== undefined && address !== '') {
    return new Map([['immichUrl', address]])
  }
  const sourceFile = configSourceFile(folder)
  if (fileText === undefined) {
    throw new PackagingError(
      `Falta a configuração do app empacotado: copie ${folder}/${EXAMPLE_FILE} para ${sourceFile} e preencha o immichUrl, ou defina a variável ${IMMICH_URL_VARIABLE} com o endereço do proxy do Immich (por exemplo http://192.168.0.10:8085).`,
    )
  }
  return jsonObjectOf(fileText, sourceFile)
}

function checkImmichUrl(immichUrl: unknown): void {
  if (typeof immichUrl !== 'string' || !isAbsoluteUrl(immichUrl)) {
    throw new PackagingError(
      `O immichUrl precisa ser o endereço completo do proxy do Immich, como http://192.168.0.10:8085. O app instalado na TV não é servido pelo proxy, então um caminho relativo não o alcança.`,
    )
  }
}

function isAbsoluteUrl(text: string): boolean {
  const url = URL.parse(text)
  return url !== null && SCHEMES.has(url.protocol) && !FORBIDDEN_IN_ADDRESS.test(text)
}
