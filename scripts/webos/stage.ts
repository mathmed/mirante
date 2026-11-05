import { join } from 'node:path'

import {
  copyDirectory,
  readOptionalText,
  removeDirectory,
  writeBytes,
  writeText,
} from '../shared/files.ts'
import type { AppInfo } from './appinfo.ts'
import { drawIcon } from './icon.ts'
import { PackagingError } from './packaging-error.ts'
import { encodePng } from './png.ts'

const APP_INFO_FILE = 'appinfo.json'
const CONFIG_FILE = 'config.json'
// The sizes the launcher of the TV shows the icons at.
const ICON_PIXELS = 80
const LARGE_ICON_PIXELS = 130

export interface StageOptions {
  // The build of the app: dist/.
  readonly build: string
  // Where the folder of the package is laid out, from scratch.
  readonly stage: string
  readonly appInfo: AppInfo
  // The text of the config.json of the package.
  readonly config: string
}

// The folder ares-package turns into the .ipk: the build as `make build` checked it, the
// appinfo.json, the config.json and the icons.
export async function stageApp({ build, stage, appInfo, config }: StageOptions): Promise<void> {
  if ((await readOptionalText(join(build, appInfo.main))) === undefined) {
    throw new PackagingError(`O build não tem ${appInfo.main}: rode make build antes.`)
  }
  await removeDirectory(stage)
  await copyDirectory(build, stage)
  await writeText(join(stage, APP_INFO_FILE), appInfo.text)
  // Replaces a config.json left in the build for a web server.
  await writeText(join(stage, CONFIG_FILE), config)
  await writeBytes(join(stage, appInfo.icon), encodePng(drawIcon(ICON_PIXELS)))
  await writeBytes(join(stage, appInfo.largeIcon), encodePng(drawIcon(LARGE_ICON_PIXELS)))
}
