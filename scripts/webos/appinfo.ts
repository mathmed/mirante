import { jsonObjectOf } from './json-file.ts'
import { PackagingError } from './packaging-error.ts'

// The fields ares-package and the TV require, and the ones Mirante relies on: the large icon of the
// launcher, and Back left to the app (see src/platform/app-exit.ts).
type TextField = 'id' | 'title' | 'type' | 'main' | 'icon' | 'largeIcon'

const WEB_APP = 'web'
const BACK_LEFT_TO_THE_APP = 'disableBackHistoryAPI'
// The rules of ares-package: lowercase letters, digits, dots, plus and minus signs in the id, and
// three numbers without leading zeros in the version.
const APP_ID = /^[a-z0-9.+-]+$/
const VERSION = /^(?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8})$/
const INDENT = 2
const TEMPLATE_FILE = 'webos/appinfo.json'

export type AppInfo = Readonly<Record<TextField | 'version', string>> & {
  // The whole file, as the TV reads it.
  readonly text: string
}

// The version of the app is the version of package.json, never one written in webos/appinfo.json.
export function versionOf(packageJsonText: string): string {
  const version = jsonObjectOf(packageJsonText, 'package.json').get('version')
  if (typeof version !== 'string' || !VERSION.test(version)) {
    throw new PackagingError(
      `A versão do package.json (${String(version)}) não serve para o webOS: use três números, como 1.2.3.`,
    )
  }
  return version
}

export function appInfoOf(templateText: string, version: string): AppInfo {
  const template = jsonObjectOf(templateText, TEMPLATE_FILE)
  checkTemplate(template)
  const fields = textFieldsOf(template)
  const text = `${JSON.stringify({ ...Object.fromEntries(template), version }, null, INDENT)}\n`
  return { ...fields, version, text }
}

function checkTemplate(template: ReadonlyMap<string, unknown>): void {
  if (template.has('version')) {
    throw new PackagingError(
      `Tire o campo version do ${TEMPLATE_FILE}: a versão do app vem do package.json.`,
    )
  }
  if (template.get(BACK_LEFT_TO_THE_APP) !== true) {
    throw new PackagingError(
      `O ${TEMPLATE_FILE} precisa de "${BACK_LEFT_TO_THE_APP}": true, para o Voltar chegar ao app.`,
    )
  }
}

function textFieldsOf(template: ReadonlyMap<string, unknown>): Readonly<Record<TextField, string>> {
  const fields = {
    id: textField(template, 'id'),
    title: textField(template, 'title'),
    type: textField(template, 'type'),
    main: textField(template, 'main'),
    icon: textField(template, 'icon'),
    largeIcon: textField(template, 'largeIcon'),
  }
  if (!APP_ID.test(fields.id)) {
    throw new PackagingError(
      `O id "${fields.id}" do ${TEMPLATE_FILE} não serve para o webOS: use letras minúsculas, números, pontos, + e -.`,
    )
  }
  if (fields.type !== WEB_APP) {
    throw new PackagingError(`O type do ${TEMPLATE_FILE} precisa ser "${WEB_APP}".`)
  }
  return fields
}

function textField(template: ReadonlyMap<string, unknown>, name: TextField): string {
  const value = template.get(name)
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PackagingError(`Falta o campo ${name} no ${TEMPLATE_FILE}.`)
  }
  return value
}
