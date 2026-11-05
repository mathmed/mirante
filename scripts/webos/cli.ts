import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

import type { Command } from './ares.ts'
import { packageApp } from './package.ts'
import { PackagingError } from './packaging-error.ts'

const USAGE_ERROR = 2
const DEFAULT_OUT = 'build/webos'
const USAGE = `uso:
  webos package [--out <pasta>]
      empacota o dist/ (rode make build antes) como o .ipk do webOS, em ${DEFAULT_OUT}/ por padrão`

export interface WebosContext {
  readonly root: string
  readonly environment: NodeJS.ProcessEnv
  readonly runCommand: (command: Command) => Promise<number>
}

export async function main(argv: readonly string[], context: WebosContext): Promise<number> {
  const [command = '', ...args] = argv
  const { values } = parseArgs({ args: [...args], options: { out: { type: 'string' } } })
  if (command !== 'package') {
    console.error(`comando desconhecido "${command}"\n${USAGE}`)
    return USAGE_ERROR
  }
  return packageReporting({
    ...context,
    outDirectory: resolve(context.root, values.out ?? DEFAULT_OUT),
  })
}

async function packageReporting(options: Parameters<typeof packageApp>[0]): Promise<number> {
  try {
    const { ipkPath, files } = await packageApp(options)
    console.log(`Pacote do webOS criado: ${ipkPath}\n  ${files.join('\n  ')}`)
    return 0
  } catch (error) {
    if (!(error instanceof PackagingError)) {
      throw error
    }
    console.error(`Empacotamento falhou: ${error.message}`)
    return 1
  }
}
