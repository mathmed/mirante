import { join } from 'node:path'

import {
  copyDirectory,
  readOptionalText,
  removeDirectory,
  writeBytes,
  writeText,
} from '../shared/files.ts'
import { drawIcon } from './icon.ts'
import { PackagingError } from './packaging-error.ts'
import { encodePng } from './png.ts'

const CONFIG_FILE = 'config.json'

interface StagedText {
  // By its path from the folder of the package.
  readonly path: string
  readonly text: string
}

interface StagedIcon {
  readonly path: string
  // The side of the square, in pixels: the size the launcher of the TV shows it at.
  readonly pixels: number
}

export interface StageOptions {
  // The build of the app: dist/.
  readonly build: string
  // Where the folder of the package is laid out, from scratch.
  readonly stage: string
  // The page the TV opens, which the build must have.
  readonly main: string
  // The text of the config.json of the package.
  readonly config: string
  // The description of the app the TV reads (appinfo.json, config.xml...).
  readonly manifest: StagedText
  readonly icons: readonly StagedIcon[]
}

// The folder a TV package is made from: the build as `make build` checked it, the description of
// the app, the config.json and the icons, drawn by icon.ts.
export async function stageApp(options: StageOptions): Promise<void> {
  const { build, stage, main } = options
  if ((await readOptionalText(join(build, main))) === undefined) {
    throw new PackagingError(`O build não tem ${main}: rode make build antes.`)
  }
  await removeDirectory(stage)
  await copyDirectory(build, stage)
  await writeText(join(stage, options.manifest.path), options.manifest.text)
  // Replaces a config.json left in the build for a web server.
  await writeText(join(stage, CONFIG_FILE), options.config)
  for (const icon of options.icons) {
    await writeBytes(join(stage, icon.path), encodePng(drawIcon(icon.pixels)))
  }
}
