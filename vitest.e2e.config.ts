import { defineConfig } from 'vitest/config'

// The end-to-end tests of the TV packages, each opened from file:// in a headless Chromium: the
// .ipk made by the real ares-package (make test-webos) and the .wgt (make test-tizen). Outside
// `make test` and CI: they need the build and Playwright's Chromium, and webOS's needs its CLI from
// npm.
export default defineConfig({
  test: {
    name: 'tv-packages',
    include: ['e2e/**/*.test.ts'],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
})
