import { writeLogoFiles } from './files.ts'

const USAGE_ERROR = 2
const USAGE = `uso:
  logo write
      escreve os arquivos do logo (o SVG do app e os da documentação) a partir de scripts/logo/mark.ts`

export interface LogoContext {
  readonly root: string
}

export async function main(argv: readonly string[], context: LogoContext): Promise<number> {
  const [command = ''] = argv
  if (command !== 'write') {
    console.error(`comando desconhecido "${command}"\n${USAGE}`)
    return USAGE_ERROR
  }
  const written = await writeLogoFiles(context.root)
  console.log(
    written.length === 0
      ? 'Os arquivos do logo já estão em dia.'
      : `Arquivos do logo escritos:\n  ${written.join('\n  ')}`,
  )
  return 0
}
