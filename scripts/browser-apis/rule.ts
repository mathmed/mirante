import type { CompatStatement } from '@mdn/browser-compat-data'
import type { Rule, Scope } from 'eslint'
import type { Identifier, MemberExpression, Node } from 'estree'

import { chromeSupport, globalApi, staticApi } from './compat.ts'

// Every name a script reads from the global scope, and the members it reads from them, checked
// against the oldest Chrome the app runs on (browserslist in package.json). Unlike
// eslint-plugin-compat it also sees a name that is only passed around (`(u || queueMicrotask)(L)`,
// how Preact schedules its renders), and it runs over the bundle, the dependencies included.
// Members of instances (`element.toggleAttribute`) are out of reach: the type of the object is
// unknown in a bundle.

export const BROWSER_APIS_RULE = 'browser-apis'

export interface BrowserApisOptions {
  // The oldest version of Chrome the app runs on.
  readonly chrome: number
  // What src/platform/polyfills.ts adds to the engines that lack it: `queueMicrotask`,
  // `Object.fromEntries`.
  readonly polyfilled: readonly string[]
}

interface ApiUse {
  readonly name: string
  readonly compat: CompatStatement | undefined
}

type Reference = Scope.Reference & { readonly isTypeReference?: boolean }

// What a script reads the global scope through, besides the names themselves.
const GLOBAL_OBJECTS: ReadonlySet<string> = new Set(['window', 'self', 'globalThis'])

const OPTIONS_SCHEMA = {
  type: 'object',
  properties: {
    chrome: { type: 'integer', minimum: 1 },
    polyfilled: { type: 'array', items: { type: 'string' }, uniqueItems: true },
  },
  required: ['chrome', 'polyfilled'],
  additionalProperties: false,
}

export const browserApisRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Use only the browser APIs the oldest Chrome of browserslist has.' },
    schema: [OPTIONS_SCHEMA],
    messages: {
      missing:
        '{{api}} is missing in Chrome {{chrome}} (added in {{since}}): polyfill it in ' +
        'src/platform/polyfills.ts and list it in .browser-apis.json, or do without it.',
    },
  },
  create(context) {
    const options = context.options[0] as BrowserApisOptions
    return {
      'Program:exit': () => {
        for (const identifier of globalReads(context.sourceCode.scopeManager)) {
          reportMissing(context, options, identifier)
        }
      },
    }
  },
}

// The references that reach a global: not declared by the script, or declared by the engine
// (the implicit globals of the TypeScript libraries).
function globalReads(scopeManager: Scope.ScopeManager): Identifier[] {
  return scopeManager.scopes
    .flatMap((scope): Reference[] => scope.references)
    .filter(
      (reference) =>
        reference.isRead() && reference.isTypeReference !== true && isGlobal(reference.resolved),
    )
    .map((reference) => reference.identifier)
    .filter((identifier) => identifier.type === 'Identifier')
}

function isGlobal(variable: Scope.Variable | null): boolean {
  return variable === null || (variable.scope.type === 'global' && variable.defs.length === 0)
}

function reportMissing(
  context: Rule.RuleContext,
  options: BrowserApisOptions,
  identifier: Identifier,
): void {
  for (const api of apisOf(identifier)) {
    const missing = missingSince(api, options)
    if (missing !== undefined) {
      context.report({
        node: identifier,
        messageId: 'missing',
        data: { api: api.name, chrome: String(options.chrome), since: missing },
      })
    }
  }
}

// The version of Chrome that added the API, when the oldest one lacks it and nothing polyfills it.
function missingSince(api: ApiUse, options: BrowserApisOptions): string | undefined {
  if (options.polyfilled.includes(api.name)) {
    return undefined
  }
  const support = api.compat === undefined ? undefined : chromeSupport(api.compat, options.chrome)
  return support === undefined || support.isSupported ? undefined : support.since
}

// The name itself, unless only its type is asked (`typeof x`, which never throws), and the member
// read from it: `Object.fromEntries`, or `queueMicrotask` through `window.queueMicrotask`.
function apisOf(identifier: Identifier): ApiUse[] {
  const own = isTypeofOperand(identifier) ? [] : [globalUse(identifier.name)]
  const member = memberName(identifier)
  if (member === undefined) {
    return own
  }
  return [
    ...own,
    GLOBAL_OBJECTS.has(identifier.name)
      ? globalUse(member)
      : { name: `${identifier.name}.${member}`, compat: staticApi(identifier.name, member) },
  ]
}

function globalUse(name: string): ApiUse {
  return { name, compat: globalApi(name) }
}

function parentOf(node: Node): Node | null {
  return (node as Rule.Node).parent
}

function isTypeofOperand(identifier: Identifier): boolean {
  const parent = parentOf(identifier)
  return parent?.type === 'UnaryExpression' && parent.operator === 'typeof'
}

function memberName(identifier: Identifier): string | undefined {
  const parent = parentOf(identifier)
  return parent?.type === 'MemberExpression' && parent.object === identifier
    ? propertyName(parent)
    : undefined
}

// `x.name` or `x['name']`; nothing for a member computed at run time.
function propertyName(member: MemberExpression): string | undefined {
  const { property } = member
  if (!member.computed && property.type === 'Identifier') {
    return property.name
  }
  return property.type === 'Literal' && typeof property.value === 'string'
    ? property.value
    : undefined
}
