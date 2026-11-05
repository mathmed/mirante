import { join } from 'node:path'

import { listFilesDeep, readBytes, readOptionalText, readText } from '../shared/files.ts'
import { compareText } from '../shared/text.ts'
import { type AppInfo, appInfoOf, versionOf } from './appinfo.ts'
import { aresPackageCommand, type Command } from './ares.ts'
import { appFiles, ipkFiles } from './ipk.ts'
import { CONFIG_SOURCE_FILE, packagedConfig } from './packaged-config.ts'
import { PackagingError } from './packaging-error.ts'
import { stageApp } from './stage.ts'

const BUILD_DIRECTORY = 'dist'
const STAGE_DIRECTORY = 'app'
const APP_INFO_TEMPLATE = 'webos/appinfo.json'

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

// dist/ plus the webOS files, packaged by ares-package and checked file by file.
export async function packageApp(options: PackageOptions): Promise<PackageResult> {
  const appInfo = await readAppInfo(options.root)
  const config = packagedConfig({
    immichUrl: options.environment['MIRANTE_IMMICH_URL'],
    fileText: await readOptionalText(join(options.root, CONFIG_SOURCE_FILE)),
  })
  const stage = join(options.outDirectory, STAGE_DIRECTORY)
  await stageApp({ build: join(options.root, BUILD_DIRECTORY), stage, appInfo, config })
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
