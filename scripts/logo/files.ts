import { join } from 'node:path'

import { readBytes, readOptionalText, writeText } from '../shared/files.ts'
import { iconSvg, logoSvg, markSvg } from './svg.ts'

// The logo files in the repository, written by `make logo` from scripts/logo/mark.ts and never
// edited by hand: the mark the app shows, and the icon and the horizontal logo of the docs.
export const LOGO_FONT = 'src/ui/fonts/playfair-display-latin-400-normal.woff2'
const MARK_FILE = 'src/ui/assets/mirante-mark.svg'
const ICON_FILE = 'docs/logo/mirante-icon.svg'
const LOGO_FILE = 'docs/logo/mirante-logo.svg'

export interface LogoFile {
  // From the root of the repository.
  readonly path: string
  readonly text: string
}

export async function logoFiles(root: string): Promise<readonly LogoFile[]> {
  const font = await readBytes(join(root, LOGO_FONT))
  return [
    { path: MARK_FILE, text: markSvg() },
    { path: ICON_FILE, text: iconSvg() },
    { path: LOGO_FILE, text: logoSvg(font) },
  ]
}

// Writes the files that differ from the geometry, and says which.
export async function writeLogoFiles(root: string): Promise<readonly string[]> {
  const written: string[] = []
  for (const file of await logoFiles(root)) {
    const path = join(root, file.path)
    if ((await readOptionalText(path)) !== file.text) {
      await writeText(path, file.text)
      written.push(file.path)
    }
  }
  return written
}
