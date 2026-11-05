import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

const SHARED = {
  restoreMocks: true,
  unstubEnvs: true,
  unstubGlobals: true,
}

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Three environments: Node.js for the CI scripts and for the pure core (it has no DOM), a
      // browser (jsdom) for the rest of the app, with the fake Immich server of test/.
      projects: [
        {
          extends: true,
          test: {
            ...SHARED,
            name: 'scripts',
            include: ['scripts/**/*.test.ts', 'test/support/**/*.test.ts'],
          },
        },
        {
          extends: true,
          test: { ...SHARED, name: 'core', include: ['src/core/**/*.test.ts'] },
        },
        {
          extends: true,
          test: {
            ...SHARED,
            name: 'app',
            environment: 'jsdom',
            include: ['src/**/*.test.{ts,tsx}'],
            exclude: [...configDefaults.exclude, 'src/core/**'],
            setupFiles: ['test/setup.ts'],
          },
        },
      ],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
        // scripts/*.ts are the CLI entry points: they only hand argv to the tested modules below
        // them and run for real in CI (the Quality Report, mutation testing).
        exclude: ['**/*.test.{ts,tsx}', 'scripts/*.ts'],
        reporter: ['text', 'text-summary', 'html', 'json-summary'],
        // A ratchet: whenever coverage goes up, Vitest raises these numbers in this file (commit
        // the change). They never go down without the owner's approval.
        thresholds: {
          autoUpdate: (newThreshold) => Math.floor(newThreshold),
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  }),
)
