import { isHttpError } from '@immich/sdk'

const SEPARATOR = '; '

// What the console shows of a failed call: for an answer of the server, its status and the reasons
// Immich gives (the message and each field its validation refuses), never only "Error: 400".
export function detailOf(error: unknown): string {
  if (!isHttpError(error)) {
    return String(error)
  }
  const status = `HTTP ${String(error.status)}`
  const reason = reasonOf(error.data)
  return reason === '' ? status : `${status}: ${reason}`
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
