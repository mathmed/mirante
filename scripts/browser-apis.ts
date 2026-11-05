// The browser APIs of the build (see "Browser APIs" in CONTRIBUTING.md).
//   <folder>...   fails when a script of the folders reads an API the oldest Chrome of the
//                 browserslist lacks and src/platform/polyfills.ts does not add (.browser-apis.json)
import { main } from './browser-apis/cli.ts'

// process.argv starts with the node binary and this script.
const ARGUMENTS_START = 2

process.exitCode = await main(process.argv.slice(ARGUMENTS_START), { root: process.cwd() })
