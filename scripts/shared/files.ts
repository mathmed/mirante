import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const MISSING_PATH = 'ENOENT'

export async function readText(path: string): Promise<string> {
  return readFile(path, 'utf8')
}

// The text of the file, or undefined when it does not exist.
export async function readOptionalText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (isMissingPath(error)) {
      return undefined
    }
    throw error
  }
}

export async function writeText(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text)
}

export async function appendText(path: string, text: string): Promise<void> {
  await appendFile(path, text)
}

export async function listFiles(directory: string): Promise<string[]> {
  try {
    return await readdir(directory)
  } catch (error) {
    if (isMissingPath(error)) {
      return []
    }
    throw error
  }
}

function isMissingPath(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === MISSING_PATH
}
