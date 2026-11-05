import { cleanOutput, plural } from '../../shared/text.ts'
import { finding, type Finding, textDetails } from '../finding.ts'
import { type Fragment, hasPassed } from '../fragment.ts'
import { Status } from '../status.ts'

// Vite prints one "<file>  <size> kB │ gzip: <size> kB" line per output file, then "✓ built in
// <time>"; es-check then checks the bundles against ES2018.
const BUNDLE_LINE = /^(dist\/\S+\.(?:js|css))\s+([\d.,]+ [kMG]?B) │ gzip:\s+([\d.,]+ [kMG]?B)/u
const BUILT_LINE = /✓ built in (\S+)$/m
const VITE_ERRORS = /Build failed with (\d+) errors?/
const ES_CHECK_ERRORS = /there were (\d+) ES version matching errors?/

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
  const viteErrors = VITE_ERRORS.exec(output)?.[1]
  if (viteErrors !== undefined) {
    return plural(Number(viteErrors), 'build error', 'build errors')
  }
  const esCheckErrors = ES_CHECK_ERRORS.exec(output)?.[1]
  if (esCheckErrors !== undefined) {
    return `${plural(Number(esCheckErrors), 'bundle breaks', 'bundles break')} the ES2018 target`
  }
  return 'Build failed'
}
