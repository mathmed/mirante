import { cleanOutput, plural } from '../../shared/text.ts'
import { finding, type Finding, textDetails } from '../finding.ts'
import { type Fragment, hasPassed } from '../fragment.ts'
import { Status } from '../status.ts'

// Vite prints one "<file>  <size> kB │ gzip: <size> kB" line per output file, then "✓ built in
// <time>"; es-check then checks the bundles against ES2018, and scripts/browser-apis.ts the browser
// APIs they read against the oldest Chrome.
const BUNDLE_LINE = /^(dist\/\S+\.(?:js|css))\s+([\d.,]+ [kMG]?B) │ gzip:\s+([\d.,]+ [kMG]?B)/u
const BUILT_LINE = /✓ built in (\S+)$/m
const VITE_ERRORS = /Build failed with (\d+) errors?/
const ES_CHECK_ERRORS = /there were (\d+) ES version matching errors?/
const MISSING_APIS = /Browser APIs: (\d+) missing in (Chrome \d+)\./

export function analyzeBuild(fragment: Fragment): Finding {
  const output = cleanOutput(fragment.output)
  return hasPassed(fragment) ? passedBuild(output) : failedBuild(output)
}

function passedBuild(output: string): Finding {
  const bundles = output
    .split('\n')
    .map(parseBundle)
    .filter((bundle) => bundle !== undefined)
  const built = bundles.length === 0 ? 'Built' : `Bundled ${bundles.join(', ')}`
  const time = BUILT_LINE.exec(output)?.[1]
  return finding(Status.Ok, time === undefined ? built : `${built} in ${time}`)
}

function parseBundle(line: string): string | undefined {
  const match = BUNDLE_LINE.exec(line.trim())
  if (match === null) {
    return undefined
  }
  const [, file = '', size = '', gzip = ''] = match
  return `${file} ${size} (gzip ${gzip})`
}

function failedBuild(output: string): Finding {
  return finding(Status.Failed, failureSummary(output), textDetails('Output', output))
}

function failureSummary(output: string): string {
  return (
    viteErrorsSummary(output) ??
    esCheckSummary(output) ??
    missingApisSummary(output) ??
    'Build failed'
  )
}

function viteErrorsSummary(output: string): string | undefined {
  const viteErrors = VITE_ERRORS.exec(output)?.[1]
  return viteErrors === undefined
    ? undefined
    : plural(Number(viteErrors), 'build error', 'build errors')
}

function esCheckSummary(output: string): string | undefined {
  const esCheckErrors = ES_CHECK_ERRORS.exec(output)?.[1]
  return esCheckErrors === undefined
    ? undefined
    : `${plural(Number(esCheckErrors), 'bundle breaks', 'bundles break')} the ES2018 target`
}

function missingApisSummary(output: string): string | undefined {
  const [, count, chrome = ''] = MISSING_APIS.exec(output) ?? []
  return count === undefined
    ? undefined
    : `${plural(Number(count), 'browser API', 'browser APIs')} missing in ${chrome}`
}
