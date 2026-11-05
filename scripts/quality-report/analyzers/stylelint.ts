import { cleanOutput, plural } from '../../shared/text.ts'
import { finding, type Finding, textDetails } from '../finding.ts'
import { type Fragment, hasPassed } from '../fragment.ts'
import { Status } from '../status.ts'

// Stylelint's string formatter ends with "✖ <n> problem(s) (<e> errors, <w> warnings)".
const PROBLEMS_LINE = /✖ (\d+) problems?/

export function analyzeStylelint(fragment: Fragment): Finding {
  if (hasPassed(fragment)) {
    return finding(Status.Ok, 'No problems in the stylesheets')
  }
  const output = cleanOutput(fragment.output)
  const problems = PROBLEMS_LINE.exec(output)?.[1]
  const summary =
    problems === undefined
      ? 'Stylelint failed'
      : plural(Number(problems), 'problem in the stylesheets', 'problems in the stylesheets')
  return finding(Status.Failed, summary, textDetails('Output', output))
}
