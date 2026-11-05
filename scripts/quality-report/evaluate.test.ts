import { describe, expect, it, vi } from 'vitest'

import { Analysis } from './analysis.ts'
import { evaluate, type Evidence } from './evaluate.ts'
import { finding } from './finding.ts'
import type { Fragment } from './fragment.ts'
import { Job, type Section } from './sections.ts'
import { Status } from './status.ts'

const BUILD: Fragment = { analysis: Analysis.Build, exitCode: 0, output: 'built', seconds: 1.5 }

const MUTATION_SECTION: Section = {
  title: 'Mutation testing (Stryker)',
  checks: [
    {
      analysis: Analysis.Build,
      job: Job.Mutation,
      label: 'build',
      analyze: (fragment) => finding(Status.Ok, `analysed ${fragment.output}`),
    },
    {
      analysis: Analysis.Mutation,
      job: Job.Mutation,
      label: 'stryker',
      analyze: () => finding(Status.Ok, 'killed'),
    },
  ],
}

function evidence(jobResults: Record<string, string>): Evidence {
  return {
    fragments: new Map([[Analysis.Build, BUILD]]),
    jobResults: new Map(Object.entries(jobResults)),
  }
}

describe('evaluate', () => {
  it('should analyse the fragments and take the worst status of the section', () => {
    const sut = evaluate(MUTATION_SECTION, evidence({ mutation: 'failure' }))

    expect(sut.status).toBe(Status.Failed)
    expect(sut.results.map(({ finding: { summary }, seconds }) => [summary, seconds])).toEqual([
      ['analysed built', 1.5],
      ['Job `mutation` ended as `failure` before running this analysis', 0],
    ])
  })

  it.each([
    [{}, Status.Skipped, 'Job `mutation` did not run: analysis not run'],
    [{ mutation: 'cancelled' }, Status.Skipped, 'Job `mutation` was cancelled: analysis not run'],
    [{ mutation: 'skipped' }, Status.Skipped, 'Job `mutation` was skipped: analysis not run'],
    [
      { mutation: 'success' },
      Status.Warning,
      'Job `mutation` passed but did not upload this result',
    ],
  ])('should explain a missing fragment when the job results are %j', (jobs, status, summary) => {
    const [, missing] = evaluate(MUTATION_SECTION, evidence(jobs)).results

    expect(missing?.finding).toStrictEqual({ status, summary })
  })

  it.each([new SyntaxError('bad JSON'), new TypeError('missing field')])(
    'should fall back to the exit code when the analyzer cannot read the output (%s)',
    (error) => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const broken: Section = {
        title: 'Mutation testing (Stryker)',
        checks: [
          {
            analysis: Analysis.Build,
            job: Job.Mutation,
            label: 'build',
            analyze: () => {
              throw error
            },
          },
        ],
      }
      const failed: Evidence = {
        fragments: new Map([[Analysis.Build, { ...BUILD, exitCode: 2 }]]),
        jobResults: new Map(),
      }

      expect(evaluate(broken, evidence({})).results[0]?.finding.summary).toBe(
        'passed; the output could not be summarised',
      )
      expect(evaluate(broken, failed).results[0]?.finding).toStrictEqual({
        status: Status.Failed,
        summary: 'failed (exit code 2); the output could not be summarised',
        details: { title: 'Output', body: 'built', format: 'text' },
      })
    },
  )

  it('should not hide a bug in an analyzer', () => {
    const buggy: Section = {
      title: 'Lint',
      checks: [
        {
          analysis: Analysis.Build,
          job: Job.Mutation,
          label: 'build',
          analyze: () => {
            throw new RangeError('bug')
          },
        },
      ],
    }

    expect(() => evaluate(buggy, evidence({}))).toThrow(RangeError)
  })
})
