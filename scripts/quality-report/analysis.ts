export const Analysis = {
  Eslint: 'eslint',
  Prettier: 'prettier',
  Stylelint: 'stylelint',
  Tsc: 'tsc',
  NpmAudit: 'npm-audit',
  Knip: 'knip',
  Vitest: 'vitest',
  DependencyCruiser: 'dependency-cruiser',
  Build: 'build',
  Mutation: 'mutation',
  Suppressions: 'suppressions',
} as const

export type Analysis = (typeof Analysis)[keyof typeof Analysis]

const ANALYSES: ReadonlySet<string> = new Set(Object.values(Analysis))

export function isAnalysis(value: string): value is Analysis {
  return ANALYSES.has(value)
}
