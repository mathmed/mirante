// Vitest global setup: every temporary directory the tests create (mkdtemp in os.tmpdir()) lands in
// one root of this run under .tmp/, which is removed when the run ends, failed or interrupted
// included. Node.js reads TMPDIR on every os.tmpdir() call and the test workers inherit it.
import { mkdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const TEMP_ROOT = resolve(import.meta.dirname, '../../.tmp')

export async function setup(): Promise<() => Promise<void>> {
  const directory = join(TEMP_ROOT, `vitest-${String(process.pid)}`)
  await rm(directory, { recursive: true, force: true })
  await mkdir(directory, { recursive: true })
  const previous = process.env['TMPDIR']
  process.env['TMPDIR'] = directory
  return async (): Promise<void> => {
    restore(previous)
    await rm(directory, { recursive: true, force: true })
  }
}

function restore(previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env['TMPDIR']
    return
  }
  process.env['TMPDIR'] = previous
}
