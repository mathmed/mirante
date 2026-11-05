// The logo of Mirante, drawn from scripts/logo/mark.ts (see CONTRIBUTING.md).
//   write   the SVG of the mark the app shows and the logo files of the docs
import { resolve } from 'node:path'

import { main } from './logo/cli.ts'

// process.argv starts with the node binary and this script.
const ARGUMENTS_START = 2

process.exitCode = await main(process.argv.slice(ARGUMENTS_START), {
  root: resolve(import.meta.dirname, '..'),
})
