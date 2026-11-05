# Contributing to Mirante

Thanks for helping! Every change comes with tests, and the checks are never loosened to let code
through. [`CLAUDE.md`](CLAUDE.md) holds the full rules (architecture, conventions, style) that people
and AI agents follow alike. Report security problems privately, as [`SECURITY.md`](SECURITY.md)
explains.

## Running it locally

You need Node.js 24 (npm refuses other versions, see `devEngines`) and npm. No Immich server is
needed for the tests: they talk to a fake one.

```sh
make setup        # locked dependencies (npm ci) and the git hooks
make quality      # every static check and the unit tests: what the pre-commit hook runs
make dev          # the app with hot reload; copy public/config.example.json to public/config.json
```

To try it on a TV, run `make build`, copy a `config.json` next to `dist/index.html` and serve `dist/`
at the address of Immich, behind a proxy that sends `/api` to Immich and adds the API key (see
"Reaching Immich" in the README). `make dev` serves the app from Vite, another origin than Immich:
it only reaches an Immich server that sends CORS headers (its development mode), and the images only
load where the key reaches them without the app.

### Make targets

| Command                    | Description                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `make setup`               | Install the locked dependencies and the git hooks.                                  |
| `make dev`                 | Serve the app with hot reload (Vite).                                               |
| `make build`               | Bundle `dist/` and the webOS build, and check them against Chromium 68.             |
| `make logo`                | Write the logo files from `scripts/logo/mark.ts` (the app's mark and `docs/logo/`). |
| `make screenshots`         | Capture the main screens at 1920x1080 into `docs/screenshots/` (Playwright).        |
| `make package-webos`       | Package the build as the LG webOS app (`.ipk`), see `docs/webos.md`.                |
| `make test-webos`          | Run the `.ipk` from `file://` in a headless Chromium (Playwright).                  |
| `make package-tizen`       | Package the build as the Samsung Tizen app (unsigned `.wgt`), see `docs/tizen.md`.  |
| `make test-tizen`          | Run the `.wgt` from `file://` in a headless Chromium (Playwright).                  |
| `make format`              | Format (Prettier) and apply the fixes ESLint can make.                              |
| `make lint`                | ESLint, Stylelint and the Prettier check.                                           |
| `make typecheck`           | tsc 7 strict: the app, the core alone, the tests and the tooling.                   |
| `make test`                | Unit tests with coverage (100%, a ratchet).                                         |
| `make lint-arch`           | Architecture contracts (dependency-cruiser).                                        |
| `make dead-code`           | Unused files, exports and dependencies (knip).                                      |
| `make audit`               | Known vulnerabilities in the dependencies.                                          |
| `make suppressions`        | Suppression ratchet against `suppressions-baseline.json`.                           |
| `make quality`             | All of the above but the build: what the pre-commit hook runs.                      |
| `make mutation`            | Mutation testing of the whole core (weekly in CI).                                  |
| `make mutation-changed`    | Mutation testing of the core files changed against `BASE` (`origin/main`).          |
| `make suppressions-update` | Lower the suppression baseline after removing suppressions.                         |
| `make risk-labels`         | Create or update the `risk:<level>` labels on GitHub (needs `gh`).                  |
| `make all`                 | Everything CI runs on a pull request.                                               |

## Making a change

1. Branch from `main`; one pull request, one subject.
2. Write the tests next to the code (`startup.test.ts` beside `startup.ts`). Mock only the external
   boundary: the Immich server and `config.json` through the fake server of `test/fake-immich.ts`
   (MSW; a request it does not answer fails the test; `test/sample-library.ts` is a small library
   for it), the console, the clock. The tests of the core and of the components, which cannot import
   the adapters, read the photo library through `test/library-stub.ts` and press keys with the fake
   remote control of `test/remote.ts`; `src/main.test.tsx` runs the whole app against the fake
   server with the key codes of the TVs.
3. Run `make quality`, plus `make build` when the change touches the app or its configuration, and
   `make mutation-changed` for `src/core`; after a visual change, `make screenshots` too.
4. Commit with [Conventional Commits](https://www.conventionalcommits.org/) (`feat`, `fix`,
   `refactor`, `chore`, `test`, `docs`, `ci`, `build`); the commit-msg hook checks it.
5. Open the pull request with the template and one `risk:<level>` label (see
   [The risk label](#the-risk-label) and [Pull request flow](#pull-request-flow)). CI posts one
   **Quality Report** comment; a failing check means it is not ready.

The fields of `config.json` are the public contract: every installation has one, so do not remove or
rename a field unless that is the point of the change. Mirante only reads from Immich: a change that
writes is out of scope.

## Writing for the TVs

- **Chromium 68 is the floor** (webOS); Tizen 6.5 runs Chromium 85. TypeScript only knows the ES2018
  built-ins, `eslint-plugin-compat` and the `mirante/browser-apis` rule check web APIs and Stylelint
  checks CSS against `browserslist` (`package.json`), and `make build` checks the bundle with es-check
  (`.escheckrc.json`, the syntax and the built-ins) and with `scripts/browser-apis.ts` (the runtime
  APIs, see below). When the code or a dependency needs an API Chromium 68 lacks, polyfill it in
  `src/platform/polyfills.ts` and name it in `.browser-apis.json` (and in the `ignore` of both
  `.escheckrc.json` entries when es-check knows it as a feature); `polyfills.test.ts` keeps the lists
  equal.
- **The remote control is the only input**: arrows, Enter and Back (Tizen 10009, webOS 461, Escape
  and Backspace on the desktop). Every action is reachable with them, the focus is always visible
  (style `:focus`, never `:focus-visible`) and never lost when a screen changes.
- **Relative paths, no service worker**: the packaged apps load from the file system.
- **Text people read** lives in `src/ui/messages.ts`, in Brazilian Portuguese; everything else is in
  English.

## The look of the app

- **Palette**: a warm near-black background (`#0E0C09`), surfaces (`#1B1710`), golds (`#D4A93C`,
  light `#F0CF7A`, dark `#8A6A1F`, for lines only) and warm text (`#F4EEDF`, secondary `#A89B7C`):
  the custom properties at the top of `src/ui/styles.css`, the same colors as the logo. Every text
  keeps a contrast of 4.5:1 or more with what is behind it.
- **Type**: Playfair Display (SIL Open Font License, `src/ui/fonts/OFL.txt`) for titles, names and
  dates, as two Latin-subset WOFF2 files (normal and italic, about 44 KB) with `font-display: swap`;
  the font of the system for the rest. No font is loaded from the network.
- **The logo** is drawn from its shapes in `scripts/logo/mark.ts`: an M on the horizon under the
  arch of a rising sun, over two lines of water. `make logo` writes it as SVG
  (`src/ui/assets/mirante-mark.svg`, which the app shows, and `docs/logo/`, with the horizontal logo
  and its name in Playfair Display), and the TV packages rasterize the same shapes into their icons
  (`scripts/packaging/icon.ts`). Never edit the SVG files by hand: a test fails while one differs
  from the shapes.
- **Motion and effects for the TVs' GPUs**: only `opacity` and `transform` animate (screens fade in
  in 320 ms, the viewer's transitions take 0.9 to 1.5 s and the slow zoom drifts for the time of a
  photo, the focused tile grows to 1.04), shadows and glows stay
  on the focused element, and darkening is done with gradients. Stylelint rejects `blur()` and the
  individual `translate`, `scale` and `rotate` properties (Chromium 104) besides what `browserslist`
  lacks.
- **Screenshots**: `make screenshots` writes the main screens to `docs/screenshots/` (WebP, each under
  300 KB) from the build, against a fake Immich whose photos are landscapes drawn from their ids
  (`e2e/screenshots.test.ts`). Run it after a visual change and commit the images with it.

## The pipeline

Strict from day one, with no baseline (the same pipeline as
[sqldoro](https://github.com/mathmed/sqldoro), adapted to a web app). Code is refactored to meet the
gates; relaxing a threshold, rule or contract needs the owner's explicit approval.

| Gate               | Tool                                                           | Guarantees                                                                                         | Runs in                      |
| ------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------- |
| Lint and format    | ESLint (typescript-eslint strict, SonarJS, security), Prettier | Every rule an error, `--max-warnings 0`; a disable needs a reason.                                 | pre-commit, `lint`           |
| Complexity         | ESLint                                                         | Complexity 5, nesting 2, 30 lines per function, 3 parameters, 300 lines per file; never disabled.  | pre-commit, `lint`           |
| Browser support    | eslint-plugin-compat, `mirante/browser-apis`, Stylelint, tsc   | No web API, CSS feature or built-in that Chromium 68 lacks.                                        | pre-commit, `lint`/`quality` |
| Types              | tsc 7 strict, plus the extra flags of `tsconfig.base.json`     | No `any`; the core type-checks without DOM or Node.js types.                                       | pre-commit, `quality`        |
| Security           | eslint-plugin-security, no-unsanitized, `npm audit`            | No `eval` or unsanitized HTML; no known vulnerable dependency.                                     | pre-commit, `lint`/`quality` |
| Dead code          | knip                                                           | No unused file, export or dependency, no stale configuration.                                      | pre-commit, `quality`        |
| Tests and coverage | Vitest (Node.js; jsdom, Testing Library and MSW for the app)   | 100% statements, branches, functions and lines, as a ratchet.                                      | pre-commit, `quality`        |
| Architecture       | dependency-cruiser                                             | The layer contracts of `.dependency-cruiser.mjs`.                                                  | pre-commit, `architecture`   |
| Build              | Vite, es-check, `scripts/browser-apis.ts`                      | Both bundles parse as ES2018 (webOS: as a script) and read no API Chromium 68 lacks unpolyfilled.  | `build`                      |
| Mutation testing   | Stryker on `src/core`                                          | The score stays above `MUTATION_MIN_SCORE` (95).                                                   | `mutation` workflow          |
| Suppressions       | `scripts/suppressions.ts`                                      | No new `eslint-disable`, `@ts-expect-error`, coverage or mutation pragma, skipped or focused test. | pre-commit, `lint`           |
| Risk label         | `scripts/risk.ts`                                              | Exactly one known `risk:<level>` label per PR.                                                     | `Risk label` workflow        |
| Report             | `scripts/quality-report.ts`                                    | One Quality Report comment per pull request.                                                       | `quality-report`             |

Git hooks run through [lefthook](https://lefthook.dev/): pre-commit formats the staged files and runs
`make quality`'s checks (the tests without the `GIT_*` variables git exports to hooks; tests that
need a repository create one with `test/support/git.ts`); commit-msg enforces Conventional Commits.
Dependabot proposes grouped weekly updates after a cooldown (major 15 days, minor 10, patch 5).

### Build and mutation

- **Build**: `npm run build` runs `vite build` (target ES2018 and Chromium 68, `base: './'`) into
  `dist/`, a module for the web; `vite build --config vite.webos.config.ts` into `build/webos-dist/`,
  the same app as one classic script (`iife`) loaded by `<script defer>` without `crossorigin`
  (`scripts/webos/classic-script.ts`), because webOS refuses module scripts from `file://`; then
  es-check with `.escheckrc.json`, which also detects newer built-ins in both bundles (the
  dependencies' code included) and reads the webOS one as a script, so `import`, `export`,
  `import.meta` and a top-level `await` fail it; and last the browser API check. CI keeps `dist/` as
  the `mirante-dist` artifact.
- **Browser APIs**: es-check only reads syntax and ES built-ins, and eslint-plugin-compat only lints
  Mirante's own calls: neither saw the `queueMicrotask` Preact passes around (`(u||queueMicrotask)(L)`),
  which left the LG on a grey screen. `scripts/browser-apis/` is an ESLint rule that uses the scope
  analysis to find every name read from the global scope (directly or through `window`, `self` or
  `globalThis`) and the members read from it (`Object.fromEntries`), and looks each one up in MDN's
  browser tables (`@mdn/browser-compat-data`) for the oldest Chrome of `browserslist`. `make lint` runs
  it over `src/` as `mirante/browser-apis`, and `node scripts/browser-apis.ts dist build/webos-dist`
  (in `npm run build`) over every script of the bundles. What `src/platform/polyfills.ts` adds is
  listed in `.browser-apis.json`. Members of instances (`element.toggleAttribute`) are out of its
  reach, since a bundle does not say what an object is: `make test-webos` exercises those at run time.
- **webOS package**: `make package-webos` packages the webOS build, unchanged, with `ares-package`
  (`scripts/webos/`, tested like the other scripts with a fake `ares-package`); `make test-webos`
  runs the real one and opens the `.ipk` from `file://` in Playwright's headless Chromium against the
  fake Immich of `e2e/`, in a browser made to look like the LG's Chromium 68 (`e2e/legacy-chromium.ts`:
  scripts served without a MIME type, so module scripts are refused, and the polyfilled APIs
  removed). Both stay out of `make quality` and CI: they need the webOS CLI from npm
  (through `npx`, see `docs/webos.md` for why it is not a devDependency) and a browser download. Run
  `make test-webos` when a change touches the packaging, `webos/`, the startup or the remote control.
- **Tizen package**: `make package-tizen` packages the web build of `dist/`, unchanged, as an unsigned `.wgt`
  that `scripts/tizen/zip.ts` writes itself (no Tizen tool; signing is the owner's manual step, see
  `docs/tizen.md`); `make test-tizen` unzips it and opens it from `file://` in the same headless
  Chromium, with a `tizen` global. It stays out of `make quality` and CI for the browser download. Run
  it when a change touches the packaging, `tizen/`, the startup or the remote control. What both
  packages share lives in `scripts/packaging/` and `e2e/packaged-app.ts`.
- **Mutation testing**: [Stryker](https://stryker-mutator.io/) mutates `src/core` (the pure logic,
  `stryker.config.json`) and runs the related tests against each mutant through its Vitest runner,
  with the TypeScript checker discarding mutants that do not compile. For each **survivor**, add the
  missing assertion; `MUTATION_MIN_SCORE` only goes up. Never commit `reports/` or `.stryker-tmp/`.

### Suppression ratchet

`scripts/suppressions.ts` counts, per file and per kind, every suppression in the source files git
tracks or would add (`.ts`, `.tsx` and the other JavaScript extensions), and compares the counts with
the committed `suppressions-baseline.json` (empty: there is none):

| Kind                                           | Matches                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `eslint-disable` / `eslint-config`             | `eslint-disable`, `-line`, `-next-line`; inline `/* eslint rule: off */` config |
| `ts-ignore` / `ts-expect-error` / `ts-nocheck` | the TypeScript directives                                                       |
| `coverage-ignore` / `stryker-disable`          | `v8`, `c8` and `istanbul ignore`; `Stryker disable`                             |
| `prettier-ignore` / `knip-tag`                 | `prettier-ignore`; the JSDoc tags knip never reports (`@public`, `@beta`...)    |
| `test-skip` / `test-fails` / `test-focus`      | `.skip`, `.skipIf`, `.runIf`, `.todo`, `xit`; `.fails`; `.only`, `fit`          |

Comments and test calls are read with the TypeScript parser (`@typescript-eslint/typescript-estree`),
so the same text in a string does not count; files that hold none of the words are not parsed.

- **A count went up** (a new suppression, or one moved to another file): the check fails and lists the
  file, kind and lines. Remove it and fix the cause. Raising the baseline
  (`npm run suppressions:update -- --allow-increase`) needs the owner's explicit approval, and shows in
  the diff.
- **A count went down**: the check fails too until you run `make suppressions-update` and commit the
  lower baseline in the same PR, so the improvement is locked in.

It runs in `make quality`, the pre-commit hook and the `lint` job, and prints a `SUPPRESSIONS_RESULT`
line for the Quality Report. Configuration that disables a check for the whole project is not counted:
call such a change out in the PR.

### The risk label

Every PR carries exactly one `risk:low`, `risk:medium`, `risk:high` or `risk:critical` label. The level
is a judgment of the `pr-writer` agent (or the person opening the PR), following the rubric in
`.claude/agents/pr-writer.md`: most PRs are low or medium; high is for changes that can break the app on
the TVs or change existing behavior drastically; critical is for changes where a failure can write to
the Immich library or leak the API key or the photos (see "Critical surfaces" in `CLAUDE.md`). High and
critical need one concrete sentence in the Risk line naming what can break. Touching pipeline files is
not by itself a reason for high.

The **Risk label** workflow (`.github/workflows/risk-label.yml`) runs `scripts/risk.ts check` on every
push and label change and fails when a PR has no risk label, more than one, or an unknown one. It lives
outside `ci.yml` so that a label change does not re-run every analysis, and is not part of the Quality
Report. `make risk-labels` creates the labels (idempotent); Dependabot's PRs get `risk:low`.

### Pull request flow

Reading AI-written diffs is the bottleneck, so the PR description is short and says what changed in
behavior, written by an agent that did not write the code (`CLAUDE.md`, "Workflow"); the risk label says
how much attention the PR deserves:

1. **`coder`** implements on a branch, runs the checks, commits one logical step per commit, pushes and
   writes handoff notes to `.handoff/<branch>.md` (gitignored), with an explicit **Not verified** list.
2. **`pr-writer`** reads the diff commit by commit, checks every claim against the diff and the tests,
   assigns the risk by judgment and fills `.github/pull_request_template.md`: a summary of one or two
   sentences that stands alone, at most one visual block, a `Deploy:` line only when there is a real
   release step, a `Risk high: <what can break>` first line only for high or critical. At most 2,500
   characters. It opens the PR with the label and stops.
3. If `pr-writer` fails, `coder` opens the PR with a minimal body and no label; the Risk label check
   stays red until a person sets one. Only the owner merges.

People opening PRs by hand get the same template from GitHub.

### Quality Report

Each pull request gets **one** comment (marker `<!-- quality-report -->`, updated on every push) with
the verdict and a section per analysis (✅ ok, ⚠️ warning, ❌ failed, ⏭️ not run). Each CI job runs
its tool through `node scripts/quality-report.ts run <analysis> -- <command>`, which keeps the tool's
exit code and saves a fragment uploaded as `quality-fragment-<job>`; the `quality-report` job renders
them (also to the job summary, the fallback for forks). Render locally with
`node scripts/quality-report.ts render --dir quality-fragments`.

To add an analysis:

1. Add a value to `Analysis` (`scripts/quality-report/analysis.ts`).
2. Write its analyzer in `scripts/quality-report/analyzers/`, tested against real output of the tool.
3. Add a `Check` to `SECTIONS` (`scripts/quality-report/sections.ts`).
4. Run the tool through the wrapper in its job, and upload `quality-fragments/` as
   `quality-fragment-<job>` with `if: ${{ !cancelled() }}`.
5. Add the job to the `needs` of `quality-report`.
