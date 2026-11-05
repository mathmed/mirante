import { join } from 'node:path'

import { configSourceFile, packagedConfig } from '../packaging/packaged-config.ts'
import { stageApp } from '../packaging/stage.ts'
import {
  listFilesDeep,
  readBytes,
  readOptionalText,
  readText,
  writeBytes,
} from '../shared/files.ts'
import { compareText } from '../shared/text.ts'
import { type Widget, widgetOf, widgetVersionOf } from './widget.ts'
import { zipArchive } from './zip.ts'

const BUILD_DIRECTORY = 'dist'
const STAGE_DIRECTORY = 'widget'
const PLATFORM_FOLDER = 'tizen'
const WIDGET_TEMPLATE = `${PLATFORM_FOLDER}/config.xml`
const WIDGET_FILE = 'config.xml'
// The size of the icon of a Samsung TV app.
const ICON_PIXELS = 117
// The name the Tizen CLI gives the package too: the name of the widget.
const WGT_EXTENSION = '.wgt'

export interface PackageOptions {
  // The root of the repository.
  readonly root: string
  // Where the package goes, with the folder it was made from.
  readonly outDirectory: string
  readonly environment: NodeJS.ProcessEnv
}

export interface PackageResult {
  readonly wgtPath: string
  // The files of the widget, by their path from its root.
  readonly files: readonly string[]
}

// dist/ plus the Tizen files, as an unsigned .wgt: the TV only installs it once the Tizen CLI signs
// the widget folder with the owner's certificates (docs/tizen.md).
export async function packageWidget(options: PackageOptions): Promise<PackageResult> {
  const widget = await readWidget(options.root)
  const config = packagedConfig({
    folder: PLATFORM_FOLDER,
    immichUrl: options.environment['MIRANTE_IMMICH_URL'],
    fileText: await readOptionalText(join(options.root, configSourceFile(PLATFORM_FOLDER))),
  })
  const stage = join(options.outDirectory, STAGE_DIRECTORY)
  await stageApp({
    build: join(options.root, BUILD_DIRECTORY),
    stage,
    main: widget.content,
    config,
    manifest: { path: WIDGET_FILE, text: widget.text },
    icons: [{ path: widget.icon, pixels: ICON_PIXELS }],
  })
  const files = (await listFilesDeep(stage)).toSorted(compareText)
  const entries = await Promise.all(
    files.map(async (path) => ({ path, content: await readBytes(join(stage, path)) })),
  )
  const wgtPath = join(options.outDirectory, `${widget.name}${WGT_EXTENSION}`)
  await writeBytes(wgtPath, zipArchive(entries))
  return { wgtPath, files }
}

async function readWidget(root: string): Promise<Widget> {
  const version = widgetVersionOf(await readText(join(root, 'package.json')))
  return widgetOf(await readText(join(root, WIDGET_TEMPLATE)), version)
}
