import { join } from 'node:path'

import { configSourceFile, packagedConfig } from '../packaging/packaged-config.ts'
import { PackagingError } from '../packaging/packaging-error.ts'
import { stageApp } from '../packaging/stage.ts'
import { listFilesDeep, readBytes, readOptionalText, readText } from '../shared/files.ts'
import { compareText } from '../shared/text.ts'
import { type AppInfo, appInfoOf, versionOf } from './appinfo.ts'
import { aresPackageCommand, type Command } from './ares.ts'
import { appFiles, ipkFiles } from './ipk.ts'

// The webOS build of `make build` (vite.webos.config.ts): one classic script, which webOS runs
// from file://.
export const WEBOS_BUILD = 'build/webos-dist'
const STAGE_DIRECTORY = 'app'
const PLATFORM_FOLDER = 'webos'
const APP_INFO_TEMPLATE = `${PLATFORM_FOLDER}/appinfo.json`
const APP_INFO_FILE = 'appinfo.json'
// The sizes the launcher of the TV shows the icons at.
const ICON_PIXELS = 80
const LARGE_ICON_PIXELS = 130

export interface PackageOptions {
  // The root of the repository.
  readonly root: string
  // Where the package goes, with the folder it was made from.
  readonly outDirectory: string
  readonly environment: NodeJS.ProcessEnv
  readonly runCommand: (command: Command) => Promise<number>
}

export interface PackageResult {
  readonly ipkPath: string
  // The files of the app in the package, by their path from its folder.
  readonly files: readonly string[]
}

// The webOS build plus the webOS files, packaged by ares-package and checked file by file.
export async function packageApp(options: PackageOptions): Promise<PackageResult> {
  const appInfo = await readAppInfo(options.root)
  const config = packagedConfig({
    folder: PLATFORM_FOLDER,
    immichUrl: options.environment['MIRANTE_IMMICH_URL'],
    fileText: await readOptionalText(join(options.root, configSourceFile(PLATFORM_FOLDER))),
  })
  const stage = join(options.outDirectory, STAGE_DIRECTORY)
  await stageApp({
    build: join(options.root, WEBOS_BUILD),
    stage,
    main: appInfo.main,
    config,
    manifest: { path: APP_INFO_FILE, text: appInfo.text },
    icons: [
      { path: appInfo.icon, pixels: ICON_PIXELS },
      { path: appInfo.largeIcon, pixels: LARGE_ICON_PIXELS },
    ],
  })
  const exitCode = await options.runCommand(aresPackageCommand(stage, options.outDirectory))
  if (exitCode !== 0) {
    throw new PackagingError(`O ares-package falhou (código ${String(exitCode)}); veja acima.`)
  }
  const ipkPath = join(options.outDirectory, `${appInfo.id}_${appInfo.version}_all.ipk`)
  return { ipkPath, files: await checkedFiles(ipkPath, stage, appInfo) }
}

async function readAppInfo(root: string): Promise<AppInfo> {
  const version = versionOf(await readText(join(root, 'package.json')))
  return appInfoOf(await readText(join(root, APP_INFO_TEMPLATE)), version)
}

// The package holds the folder it was made from, nothing less and nothing more.
async function checkedFiles(ipkPath: string, stage: string, appInfo: AppInfo): Promise<string[]> {
  const packaged = appFiles(ipkFiles(await readBytes(ipkPath)), appInfo.id).map((file) => file.path)
  const staged = await listFilesDeep(stage)
  const missing = staged.filter((path) => !packaged.includes(path))
  const extra = packaged.filter((path) => !staged.includes(path))
  if (missing.length > 0 || extra.length > 0) {
    throw new PackagingError(
      `O .ipk não tem os arquivos do app: faltam [${missing.join(', ')}], sobram [${extra.join(', ')}].`,
    )
  }
  return packaged.toSorted(compareText)
}
