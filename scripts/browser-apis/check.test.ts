import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

import {
  browserApisPlugin,
  browserApisRules,
  checkScript,
  formatProblem,
  PLUGIN_NAME,
} from './check.ts'
import type { BrowserApisOptions } from './rule.ts'

const OPTIONS: BrowserApisOptions = { chrome: 68, polyfilled: [] }
const FILE = 'dist/assets/index.js'

function missing(text: string, options: BrowserApisOptions = OPTIONS): string[] {
  return checkScript(FILE, text, options).map(
    (problem) => problem.message.split(' is missing')[0] ?? '',
  )
}

describe('checkScript', () => {
  it('should find a global the oldest Chrome lacks, with where and since when', () => {
    const sut = checkScript(FILE, 'let a = 1\nqueueMicrotask(f)', OPTIONS)

    expect(sut).toStrictEqual([
      {
        file: FILE,
        line: 2,
        column: 1,
        message:
          'queueMicrotask is missing in Chrome 68 (added in 71): polyfill it in ' +
          'src/platform/polyfills.ts and list it in .browser-apis.json, or do without it.',
      },
    ])
  })

  it('should find a global that is only passed around, as Preact schedules its renders', () => {
    expect(missing('function j(){(u||queueMicrotask)(L)}')).toStrictEqual(['queueMicrotask'])
  })

  it('should find the members of a global the oldest Chrome lacks', () => {
    expect(
      missing(
        'Object.fromEntries(a); AbortSignal.timeout(1); Promise["allSettled"](p); Object.keys(a)',
      ),
    ).toStrictEqual(['Object.fromEntries', 'AbortSignal.timeout', 'Promise.allSettled'])
  })

  it('should find a global read through window, self or globalThis', () => {
    expect(
      missing('window.queueMicrotask(f); self["structuredClone"](a); window.fetch(u); globalThis'),
    ).toStrictEqual(['queueMicrotask', 'structuredClone', 'globalThis'])
  })

  it('should let through what the engine has, what the script declares and what it computes', () => {
    expect(
      missing(
        [
          'fetch(u); new ResizeObserver(f); requestAnimationFrame(f)',
          'function g(queueMicrotask) { queueMicrotask() }',
          'const structuredClone = (a) => a; structuredClone(1)',
          'window[name](); Object[key](a); tizen.application; element.toggleAttribute("a")',
        ].join('\n'),
      ),
    ).toStrictEqual([])
  })

  it('should let a script ask whether the engine has an API, and write it', () => {
    expect(
      missing('if (typeof queueMicrotask != "function") { queueMicrotask = q }'),
    ).toStrictEqual([])
  })

  it('should let through what the app polyfills', () => {
    expect(
      missing('queueMicrotask(f); window.queueMicrotask(f); Object.fromEntries(a)', {
        chrome: 68,
        polyfilled: ['queueMicrotask', 'Object.fromEntries'],
      }),
    ).toStrictEqual([])
  })

  it('should check against the version of Chrome asked for', () => {
    expect(
      missing('queueMicrotask(f); structuredClone(a)', { chrome: 85, polyfilled: [] }),
    ).toStrictEqual(['structuredClone'])
  })

  it('should read a classic script and a module alike', () => {
    expect(missing('(function(){"use strict";queueMicrotask(f)})()')).toStrictEqual([
      'queueMicrotask',
    ])
    expect(missing('import a from "./a.js"; export default queueMicrotask')).toStrictEqual([
      'queueMicrotask',
    ])
  })

  it('should report a script that does not parse', () => {
    expect(checkScript(FILE, 'const a = (1', OPTIONS)).toStrictEqual([
      { file: FILE, line: 1, column: 13, message: 'Parsing error: Unexpected token' },
    ])
  })
})

describe('the rule over TypeScript', () => {
  function lint(text: string): string[] {
    const linter = new Linter({ configType: 'flat' })
    return linter
      .verify(
        text,
        [
          {
            files: ['**/*.ts'],
            plugins: { [PLUGIN_NAME]: browserApisPlugin },
            rules: browserApisRules(OPTIONS),
            languageOptions: {
              parser: tseslint.parser,
              parserOptions: { lib: ['es2018', 'dom'] },
            },
          },
        ],
        'src/app.ts',
      )
      .map((message) => message.message.split(' is missing')[0] ?? '')
  }

  it('should find the globals the TypeScript libraries declare', () => {
    expect(
      lint('const clone = structuredClone\nwindow.queueMicrotask(() => undefined)'),
    ).toStrictEqual(['structuredClone', 'queueMicrotask'])
  })

  it('should leave types alone and see the names the module declares', () => {
    expect(
      lint(
        [
          'type Observer = ReportingObserver',
          'let observer: ReportingObserver | undefined',
          'declare const queueMicrotask: (f: () => void) => void',
          'queueMicrotask(() => undefined)',
        ].join('\n'),
      ),
    ).toStrictEqual([])
  })
})

describe('formatProblem', () => {
  it('should write where the problem is, as editors and terminals link it', () => {
    expect(formatProblem({ file: FILE, line: 3, column: 14, message: 'm' })).toBe(`${FILE}:3:14 m`)
  })
})
