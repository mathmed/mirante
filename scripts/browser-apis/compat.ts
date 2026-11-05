import bcd, {
  type CompatStatement,
  type Identifier,
  type SimpleSupportStatement,
} from '@mdn/browser-compat-data' with { type: 'json' }

// The browser tables of MDN, read for the APIs a script reaches through a global name: the
// interfaces and functions of the web platform, the members of window and the JavaScript
// built-ins.

// "≤37": supported at some version up to 37. Read as 37, which errs on the side of a newer engine.
const RANGE_MARK = '≤'
const NO_VERSION = 'no version'

export interface ChromeSupport {
  readonly isSupported: boolean
  // The first version of Chrome with the API, as MDN writes it ("71", "≤37", "preview"), or "no
  // version" when none has it.
  readonly since: string
}

// The API a global name reaches: `fetch`, `ResizeObserver`, `requestAnimationFrame`, `Promise`...
export function globalApi(name: string): CompatStatement | undefined {
  return (
    compatOf(bcd.api, name) ??
    compatOf(bcd.javascript['builtins'], name) ??
    compatOf(bcd.api['Window'], name)
  )
}

// A member of what a global name reaches: `Object.fromEntries`, `AbortSignal.timeout`...
export function staticApi(owner: string, member: string): CompatStatement | undefined {
  const tree = ownTree(bcd.api, owner) ?? ownTree(bcd.javascript['builtins'], owner)
  return compatOf(tree, `${member}_static`) ?? compatOf(tree, member)
}

// Whether the version of Chrome runs the API as it is named: without a flag, a prefix or another
// name, and not removed since. Undefined when MDN says nothing about Chrome.
export function chromeSupport(compat: CompatStatement, chrome: number): ChromeSupport | undefined {
  const support = compat.support.chrome
  if (support === undefined) {
    return undefined
  }
  const statements = (Array.isArray(support) ? support : [support]).filter(isAsNamed)
  return {
    isSupported: statements.some(
      (statement) =>
        isAtOrBefore(statement.version_added, chrome) &&
        !isAtOrBefore(statement.version_removed ?? false, chrome),
    ),
    since: earliestVersion(statements),
  }
}

function isAsNamed(statement: SimpleSupportStatement): boolean {
  return (
    statement.flags === undefined &&
    statement.prefix === undefined &&
    statement.alternative_name === undefined
  )
}

function earliestVersion(statements: readonly SimpleSupportStatement[]): string {
  const versions = statements
    .map((statement) => statement.version_added)
    .filter((version) => version !== false)
    .toSorted((first, second) => versionNumber(first) - versionNumber(second))
  return versions[0] ?? NO_VERSION
}

function isAtOrBefore(version: string | false, chrome: number): boolean {
  return version !== false && versionNumber(version) <= chrome
}

// "preview" (not released yet) is not a number, so no version is at or after it.
function versionNumber(version: string): number {
  const number = Number(version.replace(RANGE_MARK, ''))
  return Number.isNaN(number) ? Number.POSITIVE_INFINITY : number
}

function ownTree(tree: Identifier | undefined, name: string): Identifier | undefined {
  if (tree === undefined) {
    return undefined
  }
  // Own keys only: an API named like a member of Object.prototype ("toString") is in the tables.
  const value: unknown = Object.getOwnPropertyDescriptor(tree, name)?.value
  return isTree(value) ? value : undefined
}

function isTree(value: unknown): value is Identifier {
  return typeof value === 'object' && value !== null
}

function compatOf(tree: Identifier | undefined, name: string): CompatStatement | undefined {
  return ownTree(tree, name)?.__compat
}
