import { defineConfig, mergeConfig } from 'vite'

import { classicScript } from './scripts/webos/classic-script.ts'
import { WEBOS_BUILD } from './scripts/webos/package.ts'
import baseConfig from './vite.config.ts'

// The build of the webOS app (make package-webos): the web build as one classic script, which LG's
// Chromium 68 runs from file:// where it refuses module scripts (see scripts/webos/classic-script.ts).
// The web build, served behind the proxy, stays a module.
export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [classicScript()],
    build: {
      outDir: WEBOS_BUILD,
      emptyOutDir: true,
      // Module preloads, and the polyfill Vite adds for them, are for module scripts.
      modulePreload: false,
      // One stylesheet linked from index.html, as in the web build, instead of styles injected by
      // the script, which is what an iife build does with the CSS of each chunk.
      cssCodeSplit: false,
      rolldownOptions: { output: { format: 'iife' } },
    },
  }),
)
