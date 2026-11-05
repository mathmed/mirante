// The app packaged for LG's webOS TVs (see docs/webos.md).
//   package [--out <dir>]   the webOS build (build/webos-dist/) plus appinfo.json, config.json and
//                           the icons, as an .ipk made by ares-package; build/webos/ by default
import { resolve } from 'node:path'

import { runCommand } from './webos/ares.ts'
import { main } from './webos/cli.ts'

// process.argv starts with the node binary and this script.
const ARGUMENTS_START = 2

process.exitCode = await main(process.argv.slice(ARGUMENTS_START), {
  root: resolve(import.meta.dirname, '..'),
  environment: process.env,
  runCommand,
})
