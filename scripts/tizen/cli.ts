import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { PackagingError } from '../packaging/packaging-error.ts'
import { packageWidget } from './package.ts'

const USAGE_ERROR = 2
const DEFAULT_OUT = 'build/tizen'
const USAGE = `uso:
  tizen package [--out <pasta>]
      empacota o dist/ (rode make build antes) como o .wgt do Tizen, não assinado, em ${DEFAULT_OUT}/ por padrão`

export interface TizenContext {
  readonly root: string
  readonly environment: NodeJS.ProcessEnv
}

export async function main(argv: readonly string[], context: TizenContext): Promise<number> {
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

async function packageReporting(options: Parameters<typeof packageWidget>[0]): Promise<number> {
  try {
    const { wgtPath, files } = await packageWidget(options)
    console.log(
      `Pacote do Tizen criado, sem assinatura: ${wgtPath}\n  ${files.join('\n  ')}\nA TV só o instala assinado com os certificados do dono: veja docs/tizen.md.`,
    )
    return 0
  } catch (error) {
    if (!(error instanceof PackagingError)) {
      throw error
    }
    console.error(`Empacotamento falhou: ${error.message}`)
    return 1
  }
}
