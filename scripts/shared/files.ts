import { appendFile, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, posix, relative, sep } from 'node:path'

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

export async function readBytes(path: string): Promise<Uint8Array> {
  return readFile(path)
}

export async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
}

export async function copyDirectory(from: string, to: string): Promise<void> {
  await cp(from, to, { recursive: true, errorOnExist: true, force: false })
}

// Removes the folder and everything in it; a folder that does not exist is already removed.
export async function removeDirectory(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true })
}

// Every file under the folder, at any depth, by its path from the folder with forward slashes.
export async function listFilesDeep(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(directory, join(entry.parentPath, entry.name)).split(sep).join(posix.sep),
    )
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
