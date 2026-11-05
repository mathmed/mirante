.PHONY: setup dev build package-webos format lint typecheck test lint-arch dead-code audit suppressions suppressions-update quality mutation mutation-changed risk-labels all

# Base branch of mutation-changed
BASE ?= origin/main

# Install the locked dependencies and the git hooks
setup:
	npm ci
	npm run hooks

# Serve the app with hot reload (Vite); public/config.json points it at an Immich server
dev:
	npm run dev

# Bundle the app into dist/ (Vite, relative paths) and check it against ES2018 (es-check)
build:
	npm run build

# Package dist/ as the app of LG's webOS TVs: build/webos/com.mathmed.mirante_<version>_all.ipk, with
# the config.json of webos/config.json or MIRANTE_IMMICH_URL (see docs/webos.md)
package-webos: build
	npm run package:webos

# Format every file and apply the fixes ESLint can make on its own
format:
	npm run format
	npm run lint:fix

# Lint (ESLint: typescript-eslint strict, complexity, security and browser compatibility rules;
# Stylelint: CSS the TVs support) and check formatting (Prettier)
lint:
	npm run lint
	npm run lint:css
	npm run format:check

# Type check with tsc 7: the app (ES2018 and the DOM), the pure core alone, the tests, the tooling
typecheck:
	npm run typecheck

# Unit tests with coverage (Vitest); the thresholds are a ratchet at 100%
test:
	npm run test:coverage

# Architecture contracts (dependency-cruiser, see .dependency-cruiser.mjs)
lint-arch:
	npm run lint:arch

# Unused files, exports and dependencies (knip)
dead-code:
	npm run dead-code

# Known vulnerabilities in the dependencies
audit:
	npm audit

# Suppression ratchet: fails when the suppressions (eslint-disable, @ts-expect-error, skipped tests...)
# in the source and the tests differ from suppressions-baseline.json
suppressions:
	npm run suppressions

# Lower the baseline after removing suppressions (refuses to raise it, see CONTRIBUTING.md)
suppressions-update:
	npm run suppressions:update

# Every check of the pre-commit hook and of the lint, quality and architecture CI jobs
quality: lint typecheck test lint-arch dead-code audit suppressions

# Mutation testing of the whole core (slow; weekly in CI). Report: reports/mutation/mutation.html
mutation:
	npm run mutation

# Mutation testing of the core files changed against BASE: what the PR job runs
mutation-changed:
	npm run mutation:changed -- --base $(BASE)

# Create (or update) the risk:<level> labels, and the dependencies label Dependabot's PRs carry with
# risk:low, on the GitHub repository (needs an authenticated gh)
risk-labels:
	gh label create "risk:low" --color 0E8A16 --description "Low risk: no behavior change" --force
	gh label create "risk:medium" --color FBCA04 --description "Medium risk: new behavior or release steps" --force
	gh label create "risk:high" --color D93F0B --description "High risk: can break the app on the TVs or changes behavior drastically" --force
	gh label create "risk:critical" --color B60205 --description "Critical risk: can write to or expose the Immich library or its API key" --force
	gh label create "dependencies" --color 0366D6 --description "Pull requests that update a dependency file" --force

# Everything CI runs on a pull request
all: quality build mutation-changed
