// What comes from outside (config.json, the stored settings) is JSON of any shape: read here, then
// checked field by field where it is used.
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined
    }
    throw error
  }
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// The fields of a JSON object by name; undefined for anything else.
export function fieldsOf(value: unknown): ReadonlyMap<string, unknown> | undefined {
  return isRecord(value) ? new Map(Object.entries(value)) : undefined
}
