import { describe, expect, it } from 'vitest'

import { Analysis } from '../analysis.ts'
import type { Fragment } from '../fragment.ts'
import { Status } from '../status.ts'
import { analyzeBuild } from './build.ts'

const BUILT = `
> mirante@0.0.0 build
> vite build && es-check

vite v8.3.5 building client environment for production...
transforming...
✓ 28 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  0.39 kB │ gzip:  0.26 kB
dist/assets/index-B1h7ZHMt.css   1.01 kB │ gzip:  0.52 kB
dist/assets/index-B4XHftxq.js   44.51 kB │ gzip: 15.53 kB │ map: 219.19 kB

✓ built in 95ms
vite v8.3.5 building client environment for production...
build/webos-dist/index.html                  0.36 kB │ gzip:  0.24 kB
build/webos-dist/assets/index-BUtpiu81.js   62.52 kB │ gzip: 21.49 kB │ map: 317.19 kB

✓ built in 173ms
info: ES-Check: checking 1 file...
info: ✓ ES-Check passed! All files are ES9 compatible.
Browser APIs: 2 script(s) use only what Chrome 68 has (polyfilled: queueMicrotask).`

const VITE_BROKEN = `vite v8.3.5 building client environment for production...
transforming...
✓ 3 modules transformed.
✗ Build failed in 90ms
error during build:
Build failed with 1 error:

[builtin:vite-transform] Expected \`}\` but found \`EOF\``

const ES_CHECK_BROKEN = `✓ built in 95ms
info: ES-Check: checking 2 files...
error: ES-Check: there were 2 ES version matching errors.
      · error: Error: Unsupported features detected: ObjectFromEntries.`

function build(output: string, exitCode: number): Fragment {
  return { analysis: Analysis.Build, exitCode, output, seconds: 1 }
}

describe('analyzeBuild', () => {
  it('should report the size of the scripts and stylesheets, and the build time', () => {
    expect(analyzeBuild(build(BUILT, 0))).toStrictEqual({
      status: Status.Ok,
      summary:
        'Bundled dist/assets/index-B1h7ZHMt.css 1.01 kB (gzip 0.52 kB), ' +
        'dist/assets/index-B4XHftxq.js 44.51 kB (gzip 15.53 kB), ' +
        'build/webos-dist/assets/index-BUtpiu81.js 62.52 kB (gzip 21.49 kB) in 95ms',
    })
  })

  it('should not need Vite details to be ok', () => {
    expect(analyzeBuild(build('', 0)).summary).toBe('Built')
  })

  it('should count the build errors', () => {
    const sut = analyzeBuild(build(VITE_BROKEN, 1))

    expect(sut.status).toBe(Status.Failed)
    expect(sut.summary).toBe('1 build error')
    expect(sut.details?.body).toBe(VITE_BROKEN)
  })

  it('should count the bundles that break the browser target', () => {
    expect(analyzeBuild(build(ES_CHECK_BROKEN, 1)).summary).toBe(
      '2 bundles break the ES2018 target',
    )
    expect(
      analyzeBuild(
        build(
          ES_CHECK_BROKEN.replace(
            'were 2 ES version matching errors',
            'were 1 ES version matching error',
          ),
          1,
        ),
      ).summary,
    ).toBe('1 bundle breaks the ES2018 target')
  })

  it('should count the browser APIs the oldest Chrome lacks', () => {
    const output = `${BUILT}
dist/assets/index.js:1:1488 queueMicrotask is missing in Chrome 68 (added in 71): polyfill it.
Browser APIs: 1 missing in Chrome 68.`

    const sut = analyzeBuild(build(output, 1))

    expect(sut.summary).toBe('1 browser API missing in Chrome 68')
    expect(sut.details?.body).toContain('queueMicrotask is missing in Chrome 68')
    expect(analyzeBuild(build(output.replace(': 1 missing', ': 3 missing'), 1)).summary).toBe(
      '3 browser APIs missing in Chrome 68',
    )
  })

  it('should fail without details when the command itself fails', () => {
    expect(analyzeBuild(build('sh: 1: vite: not found', 127)).summary).toBe('Build failed')
  })
})
