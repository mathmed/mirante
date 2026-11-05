import { defineConfig } from 'vitest/config'

// The end-to-end test of the webOS package (make test-webos): the real ares-package, the .ipk
// unpacked and opened from file:// in a headless Chromium. Outside `make test` and CI: it needs
// the build, the webOS CLI from npm and Playwright's Chromium.
export default defineConfig({
  test: {
    name: 'webos',
    include: ['e2e/**/*.test.ts'],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
})
