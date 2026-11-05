import { spawn } from 'node:child_process'

// LG's webOS CLI, run through npx at this exact version instead of being a devDependency: every
// release ships an npm-shrinkwrap.json that pins dependencies with known vulnerabilities, which
// overrides cannot replace, so `npm audit` (in make quality) would fail. npx keeps it out of the
// project's dependency tree; bump the version by hand.
export const WEBOS_CLI = '@webos-tools/cli@3.2.6'
const COMMAND_NOT_FOUND = 127

export type Command = readonly [string, ...string[]]

// --no-minify: ares-package runs terser over every script by default, and the package must hold
// the bundle `make build` checked against ES2018, byte for byte.
export function aresPackageCommand(appDirectory: string, outDirectory: string): Command {
  return [
    'npx',
    '--yes',
    `--package=${WEBOS_CLI}`,
    'ares-package',
    '--no-minify',
    '--outdir',
    outDirectory,
    appDirectory,
  ]
}

// Runs the command with the terminal of the packaging, without a shell, and settles with its exit
// code.
export async function runCommand([program, ...args]: Command): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(program, args, { stdio: 'inherit' })
    child.on('error', (error) => {
      console.error(`Não foi possível rodar ${program}: ${error.message}`)
      resolve(COMMAND_NOT_FOUND)
    })
    child.on('close', (code) => {
      resolve(code ?? 1)
    })
  })
}
