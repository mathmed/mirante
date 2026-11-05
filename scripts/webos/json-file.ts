import { PackagingError } from './packaging-error.ts'

// A JSON file the packaging reads (package.json, webos/appinfo.json, webos/config.json), by field.
export function jsonObjectOf(text: string, file: string): ReadonlyMap<string, unknown> {
  const value = parsedJson(text, file)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PackagingError(`O ${file} precisa ser um objeto JSON, entre chaves.`)
  }
  return new Map(Object.entries(value))
}

function parsedJson(text: string, file: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new PackagingError(`O ${file} não é um JSON válido: ${error.message}`)
    }
    throw error
  }
}
