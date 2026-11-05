import type { Plugin } from 'vite'

// LG's webOS opens the app from file://, where its Chromium (68 on the owner's TV) reads every file
// with an empty MIME type and refuses a module script for it: "Failed to load module script: The
// server responded with a non-JavaScript MIME type of ''". The webOS build (vite.webos.config.ts)
// is one classic script (iife), and its index.html loads it as such: deferred like a module, so it
// still runs once the page is parsed, and without crossorigin, which file:// has no use for.

const MODULE_SCRIPT = /<script type="module" crossorigin src="([^"]+)"><\/script>/g
const CROSSORIGIN = / crossorigin(?=[\s>])/g
// What a page that loads only classic scripts never has.
const MODULE_MARKS: readonly string[] = ['type="module"', 'crossorigin', 'modulepreload']

export function classicScriptHtml(html: string): string {
  const classic = html
    .replace(MODULE_SCRIPT, '<script defer src="$1"></script>')
    .replace(CROSSORIGIN, '')
  const left = MODULE_MARKS.filter((mark) => classic.includes(mark))
  if (left.length > 0) {
    throw new Error(`index.html still loads modules (${left.join(', ')}): ${classic}`)
  }
  if (!classic.includes('<script defer src="')) {
    throw new Error(`index.html loads no script: ${classic}`)
  }
  return classic
}

// After Vite has written the tags of the bundle into index.html.
export function classicScript(): Plugin {
  return {
    name: 'mirante:classic-script',
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: classicScriptHtml },
  }
}
