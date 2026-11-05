import { defineConfig } from 'vite'

// The oldest engine Mirante runs on: the webOS browser (Chromium 68). Samsung's Tizen 6.5 runs
// Chromium 85. `make build` checks the output with es-check against ES2018.
const TARGETS = ['es2018', 'chrome68']

export default defineConfig({
  // Relative paths: the packaged TV apps (.wgt, .ipk) load the app from the file system.
  base: './',
  // No client-side routes: an unknown path, like a missing config.json, is a 404 instead of index.html.
  appType: 'mpa',
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  build: {
    target: TARGETS,
    cssTarget: TARGETS,
    // The TVs' developer tools are the only debugger on the device.
    sourcemap: true,
  },
})
