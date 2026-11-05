import { describe, expect, it } from 'vitest'

import { Analysis } from '../analysis.ts'
import type { Fragment } from '../fragment.ts'
import { Status } from '../status.ts'
import { analyzeStylelint } from './stylelint.ts'

const UNSUPPORTED = `
src/ui/styles.css
  12:3  ✖  Unexpected browser feature "css-has" is not supported by Chrome 68  plugin/no-unsupported-browser-features
  20:3  ✖  Unexpected browser feature "css-aspect-ratio" is not supported by Chrome 68  plugin/no-unsupported-browser-features

✖ 2 problems (2 errors, 0 warnings)`

function stylelint(output: string, exitCode: number): Fragment {
  return { analysis: Analysis.Stylelint, exitCode, output, seconds: 1 }
}

describe('analyzeStylelint', () => {
  it('should be ok when the stylesheets have no problem', () => {
    expect(analyzeStylelint(stylelint('', 0))).toStrictEqual({
      status: Status.Ok,
      summary: 'No problems in the stylesheets',
    })
  })

  it('should count the problems and show them', () => {
    const sut = analyzeStylelint(stylelint(UNSUPPORTED, 2))

    expect(sut.status).toBe(Status.Failed)
    expect(sut.summary).toBe('2 problems in the stylesheets')
    expect(sut.details?.body).toBe(UNSUPPORTED.trim())
  })

  it('should use the singular for one problem', () => {
    expect(analyzeStylelint(stylelint('✖ 1 problem (1 error, 0 warnings)', 2)).summary).toBe(
      '1 problem in the stylesheets',
    )
  })

  it('should show the output when Stylelint itself fails', () => {
    const sut = analyzeStylelint(stylelint('Error: No configuration provided', 78))

    expect(sut.summary).toBe('Stylelint failed')
    expect(sut.details?.body).toBe('Error: No configuration provided')
  })
})
