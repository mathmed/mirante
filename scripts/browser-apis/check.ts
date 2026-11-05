import { type Linter as Config, type ESLint, Linter } from 'eslint'

import { BROWSER_APIS_RULE, type BrowserApisOptions, browserApisRule } from './rule.ts'

// The rule as a plugin of its own: eslint.config.ts runs it over the app, and the check below over
// the bundle.
export const PLUGIN_NAME = 'mirante'
export const browserApisPlugin: ESLint.Plugin = { rules: { [BROWSER_APIS_RULE]: browserApisRule } }

export function browserApisRules(options: BrowserApisOptions): Config.RulesRecord {
  return { [`${PLUGIN_NAME}/${BROWSER_APIS_RULE}`]: ['error', options] }
}

export interface Problem {
  readonly file: string
  readonly line: number
  readonly column: number
  readonly message: string
}

// The APIs a built script reads that the oldest Chrome lacks; a script that does not parse is a
// problem too.
export function checkScript(file: string, text: string, options: BrowserApisOptions): Problem[] {
  const linter = new Linter({ configType: 'flat' })
  const messages = linter.verify(
    text,
    [
      {
        plugins: { [PLUGIN_NAME]: browserApisPlugin },
        rules: browserApisRules(options),
        languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      },
    ],
    file,
  )
  return messages.map(({ line, column, message }) => ({ file, line, column, message }))
}

export function formatProblem(problem: Problem): string {
  return `${problem.file}:${String(problem.line)}:${String(problem.column)} ${problem.message}`
}
