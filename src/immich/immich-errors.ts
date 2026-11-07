import { isHttpError } from '@immich/sdk'

const SEPARATOR = '; '
// What the log keeps of an answer in plain text (a page of the proxy, say).
const MAX_TEXT_LENGTH = 200

// What the console shows of a failed call: for an answer of the server, its status and the reasons
// Immich gives (the message and each field its validation refuses), never only "Error: 400".
export function detailOf(error: unknown): string {
  if (!isHttpError(error)) {
    return String(error)
  }
  const status = `HTTP ${String(error.status)}`
  const reason = reasonOf(dataOf(error.data))
  return reason === '' ? status : `${status}: ${reason}`
}

// The SDK reads the answers of some calls as text (those that answer nothing when they succeed):
// their JSON is read here, and any other text kept as the message.
function dataOf(data: unknown): unknown {
  if (typeof data !== 'string') {
    return data
  }
  try {
    return JSON.parse(data)
  } catch (error) {
    // Parsing a string fails with a SyntaxError alone: the text was no JSON.
    return { message: data.trim().slice(0, MAX_TEXT_LENGTH), parseError: error }
  }
}

function reasonOf(data: unknown): string {
  const message = textOf(fieldOf(data, 'message'))
  const fields = fieldReasonsOf(fieldOf(data, 'errors'))
  return fields.length === 0 ? message : `${message} (${fields.join(SEPARATOR)})`
}

// Each entry of a validation error: the path of the field and why it is refused.
function fieldReasonsOf(errors: unknown): readonly string[] {
  if (!Array.isArray(errors)) {
    return []
  }
  return errors.map((entry: unknown) => {
    const path: unknown = fieldOf(entry, 'path')
    const where = Array.isArray(path) ? path.map(String).join('.') : ''
    const why = textOf(fieldOf(entry, 'message'))
    return where === '' ? why : `${where}: ${why}`
  })
}

function fieldOf(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, name) : undefined
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
