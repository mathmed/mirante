// The app packaged for Samsung's Tizen TVs (see docs/tizen.md).
//   package [--out <dir>]   dist/ plus config.xml, config.json and the icon, as an unsigned .wgt;
//                           build/tizen/ by default
import { resolve } from 'node:path'

import { main } from './tizen/cli.ts'

// process.argv starts with the node binary and this script.
const ARGUMENTS_START = 2

process.exitCode = await main(process.argv.slice(ARGUMENTS_START), {
  root: resolve(import.meta.dirname, '..'),
  environment: process.env,
})
