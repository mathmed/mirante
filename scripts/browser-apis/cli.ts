import { join } from 'node:path'

import { listFilesDeep, readText } from '../shared/files.ts'
import { checkScript, formatProblem, type Problem } from './check.ts'
import { browserApisOptions, CONFIG_FILE } from './options.ts'
import type { BrowserApisOptions } from './rule.ts'

const USAGE_ERROR = 2
const SCRIPT_EXTENSION = '.js'
const USAGE = `usage:
  browser-apis <folder>...
      check every script of the folders (the build) against the oldest Chrome of the browserslist`

export interface BrowserApisContext {
  // The repository: its package.json (browserslist) and ${CONFIG_FILE}.
  readonly root: string
}

export async function main(argv: readonly string[], context: BrowserApisContext): Promise<number> {
  if (argv.length === 0) {
    console.error(USAGE)
    return USAGE_ERROR
  }
  const config: unknown = JSON.parse(await readText(join(context.root, CONFIG_FILE)))
  const options = browserApisOptions(context.root, config)
  const scripts = await scriptsOf(argv.map((folder) => join(context.root, folder)))
  if (scripts.length === 0) {
    console.error(`No script to check in ${argv.join(', ')}: run the build first.`)
    return 1
  }
  return report(await problemsOf(scripts, options), scripts.length, options)
}

async function scriptsOf(folders: readonly string[]): Promise<string[]> {
  const files = await Promise.all(
    folders.map(async (folder) => (await listFilesDeep(folder)).map((file) => join(folder, file))),
  )
  return files.flat().filter((file) => file.endsWith(SCRIPT_EXTENSION))
}

async function problemsOf(
  scripts: readonly string[],
  options: BrowserApisOptions,
): Promise<Problem[]> {
  const problems = await Promise.all(
    scripts.map(async (script) => checkScript(script, await readText(script), options)),
  )
  return problems.flat()
}

function report(
  problems: readonly Problem[],
  scripts: number,
  options: BrowserApisOptions,
): number {
  for (const problem of problems) {
    console.error(formatProblem(problem))
  }
  const target = `Chrome ${String(options.chrome)}`
  const polyfilled = options.polyfilled.join(', ')
  if (problems.length > 0) {
    console.error(`Browser APIs: ${String(problems.length)} missing in ${target}.`)
    return 1
  }
  console.log(
    `Browser APIs: ${String(scripts)} script(s) use only what ${target} has (polyfilled: ${polyfilled}).`,
  )
  return 0
}
