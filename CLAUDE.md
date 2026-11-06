# CLAUDE.md

Guidance for AI coding agents working in this repository. `AGENTS.md` is a symlink to this file, so
Cursor, Codex and other tools that read `AGENTS.md` follow the same rules.

## Project

**Mirante** is an open-source (MIT) photo gallery viewer for TVs: it runs in the browsers of a Samsung
Tizen 6.5 TV (Chromium ~85) and an LG webOS TV (Chromium 68 or later), and as an app packaged for each
(an unsigned `.wgt` the owner signs, an `.ipk`). It reads the photos of an Immich server with `@immich/sdk`, read only, and is
driven by the remote control alone. TypeScript and Preact, built with Vite; the tooling runs on Node.js
24 and npm. See the README for the v1 scope and what is deliberately out of it.

## Commands

```bash
make setup             # install the locked dependencies and the git hooks
make dev               # serve the app with hot reload (Vite); public/config.json points it at Immich
make build             # bundle dist/ and the webOS build/webos-dist/ (Vite), check them against ES2018 (es-check) and Chrome 68's APIs
make logo              # write the logo files from scripts/logo/mark.ts (src/ui/assets/, docs/logo/)
make screenshots       # the main screens at 1920x1080, headless Chromium, into docs/screenshots/ (WebP)
make package-webos     # the build as the LG webOS app: build/webos/com.mathmed.mirante_<version>_all.ipk
make test-webos        # end-to-end: the .ipk unpacked and run from file:// in a headless Chromium
make package-tizen     # the build as the Samsung Tizen app, unsigned: build/tizen/Mirante.wgt and build/tizen/widget/
make test-tizen        # end-to-end: the .wgt unzipped and run from file:// in a headless Chromium
make format            # format with Prettier and apply the fixes ESLint can make
make lint              # ESLint (strict, complexity, security, browser support), Stylelint and the Prettier check
make typecheck         # tsc 7 strict: the app, the pure core alone, the tests and the tooling
make test              # unit tests with coverage (Vitest; thresholds are a ratchet at 100%)
make lint-arch         # architecture contracts (dependency-cruiser)
make dead-code         # unused files, exports and dependencies (knip)
make audit             # known vulnerabilities in the dependencies (npm audit)
make suppressions      # suppression ratchet: fails when eslint-disable, @ts-expect-error, skipped tests... differ from the baseline
make quality           # all of the above but the build: what the pre-commit hook and the CI static jobs run
make suppressions-update # lower suppressions-baseline.json after removing suppressions (never raises it)
make mutation          # mutation testing of the whole core (weekly in CI)
make mutation-changed  # mutation testing of the core files changed vs BASE (default origin/main); runs on every PR
make risk-labels       # create/update the risk:<level> labels on GitHub (needs gh)
make all               # everything CI runs on a pull request
```

Always use `npm ci` / `npm install` (never another package manager) and commit `package-lock.json`.

## Architecture rules

```
src/core/      pure logic: the startup flow, the runtime configuration, the photo library interface and
               its domain types, the order of albums, photos and months, the spatial focus navigation
               of the grids, the scroll that keeps the focus of a long list in view (list-scroll), the feed of every photo ("Todas": photo-feed, its months read on demand,
               and feed-layout, its grid with a heading per month), the count of the library under
               the logo (library-summary), the stack of screens, the remote control keys, and the presentations:
               their settings (presentation-settings, settings-input, settings-storage,
               settings-form), the engine (presentation: playlists, rounds, what loads ahead), the
               seeded shuffle, their sources, the transitions (presentation-effects) and the captions;
               and the photo book: how many photos each page takes (book-pagination), the layout of
               a page as an optimization over guillotine cuts (page-arrangement, page-layout,
               book-geometry, which takes the shape of the page as a parameter), the book and its
               spreads (book), its remote control (book-navigation, and book-moves: where up and
               down go among the photos of a spread), its sources and the seeds it keeps
               (book-source, book-seeds)
src/immich/    the photo library implemented with @immich/sdk, read only
src/platform/  what differs between TVs and browsers: config.json, polyfills, the console, the key
               codes of the remote controls of Tizen and webOS (and the Info key Tizen registers),
               the localStorage of the settings and of the seeds of the books, the random seeds
src/ui/        Preact components, src/ui/messages.ts (every text people read, with its companions
               settings-messages.ts and book-messages.ts, split for the size of a file), styles.css, the
               fonts it ships (src/ui/fonts) and the mark and the icon of the logo (src/ui/assets,
               written by make logo)
src/main.tsx   composition root: wires the adapters into the UI
scripts/       tooling: the logo (scripts/logo: its shapes, the SVG files and their check, and the
               two alternatives of the icon, only drawn into a screenshot), the TV
               packages (scripts/packaging, shared: the icon, the packaged config.json, the app
               folder; scripts/webos, with the classic-script plugin of the webOS build;
               scripts/tizen), the browser API check (scripts/browser-apis), Quality Report,
               suppression ratchet, mutation runner, risk label check
test/          test support: the fake Immich server (MSW), the answers it shares with the one of e2e/
               (test/immich-answers.ts) and its sample library, the stub photo
               library and the fake remote control of the component tests, the test setup, throwaway
               git repositories, the .ipk, .wgt (zip) and PNG helpers of the packaging tests
webos/         the appinfo.json of the webOS app (no version: it comes from package.json) and
               config.example.json; webos/config.json is gitignored
tizen/         the config.xml of the Tizen widget (no version: it comes from package.json) and
               config.example.json; tizen/config.json is gitignored
e2e/           the end-to-end tests of the TV packages (Playwright, vitest.e2e.config.ts), what they
               share, the emulation of the LG's Chromium 68 (legacy-chromium.ts), the fake Immich
               they run against on a real port, and the screenshots of the docs (make
               screenshots), with their library of drawn landscapes
docs/          docs/webos.md and docs/tizen.md: packaging, Developer Mode, signing (Tizen),
               installing and debugging on an LG or a Samsung TV; docs/logo and docs/screenshots,
               both generated (make logo, make screenshots)
```

- `src/core` imports nothing from the other layers and no package at all (not even Preact or the
  Immich SDK), and runs without the DOM or Node.js: `make typecheck` checks it with the ES2018
  library alone. Platform services reach it through interfaces it declares (`PhotoLibrary`,
  `StartupDependencies`, `KeySource`).
- Only `src/immich` imports `@immich/sdk`. It implements the core `PhotoLibrary` and translates the
  SDK's DTOs into the core's domain types (`ServerInfo`, `Album`, `Photo`, `TimelineMonth`; videos
  are left out) and its errors into `PhotoLibraryError` with a `LibraryFailure`. Nothing else ever
  sees an SDK type, and every answer is checked where it enters. Every call passes the configured
  address, the key when there is one and an abort signal; never the SDK's global defaults (`init`,
  `setApiKey`).
- **Same origin, key in the proxy**: Immich only sends CORS headers in development, so Mirante is
  served at the address of Immich, behind a reverse proxy that sends `/api` to it and may add the
  `x-api-key` header itself. `immichUrl` may be relative (empty or a path: the server of the page),
  and `apiKey` is optional: without it no key is sent. Images load through `<img src>` from the API
  address on the same origin (`/api/assets/{id}/thumbnail?size=thumbnail|preview`), never as blob
  URLs and never with the key in the URL, so they only load when the proxy adds the key (or the
  browser has an Immich session there). Grids use the `thumbnail` size, the viewer the `preview`;
  never the original.
- **Read only**: the adapter only calls endpoints that read (the key check `POST /auth/validateToken`
  changes nothing and needs no permission; `POST /search/random`, the random draw of the library,
  only carries its filters). Never upload, edit, delete, favorite or archive. `docs/proxy.md` lists
  every route and method the app calls, for the owner's proxy to allow exactly those: a change in
  what reaches Immich updates it, and `CHANGELOG.md` says so.
- **Captions** come from `GET /assets/{id}` (`exifInfo.description`; the listings do not carry
  it), for the photo on the screen and the next one only, through the small cache of
  `src/core/captions.ts`: never for a whole list.
- `src/platform` serves the core and imports neither the UI nor the adapter. `config.json` is read
  only through `src/platform/config-file.ts` (with `XMLHttpRequest`, which reads `file://` in the
  packaged apps), and the console is written only through `src/platform/error-log.ts`.
- Components (`src/ui`) get the adapters from `src/main.tsx` as props; they never import `src/immich`
  or `src/platform`. Preact is only imported by `src/ui` and `src/main.tsx`.
- Product code never imports `scripts/` or `test/`, and the scripts never import the product.
- Unit tests live next to the code (`startup.test.ts` beside `startup.ts`). The core and the scripts
  run in Node.js; the rest of the app runs in jsdom with Testing Library, against the fake Immich
  server of `test/fake-immich.ts` (MSW), which fails any request it does not answer. No test reaches
  a real server or uses a real API key.
- CI analyses never post comments on their own: each job runs its tool through
  `node scripts/quality-report.ts run <analysis> -- <command>` and uploads the fragment; the
  `quality-report` job builds the single PR comment. A new analysis needs an `Analysis` value, an
  analyzer, a `Check` in `SECTIONS`, the wrapper and the artifact in its job, the job in the `needs` of
  `quality-report`, and tests (see CONTRIBUTING.md, "Quality Report"). The wrapper keeps the tool's exit
  code: the job stays the gate.
- Temporary directories are always removed: tests create them in `os.tmpdir()`, which the Vitest
  global setup (`test/support/temp-root.ts`) points at a root under `.tmp/` removed when the run ends.
- Every change comes with tests.

### TVs and the remote control

- **Chromium 68 is the floor.** Target ES2018; no newer syntax or built-in (`Array.prototype.flat`,
  `Object.fromEntries`, `globalThis`, `structuredClone`, top-level `await`...), no CSS Chromium 68
  lacks (`:has`, `aspect-ratio`, `gap` in flexbox, `:focus-visible`, `inset`...), no runtime API it
  lacks (`queueMicrotask`, `structuredClone`, `AbortSignal.timeout`...). The ES2018 library,
  `eslint-plugin-compat`, the `mirante/browser-apis` rule (the app in `make lint`, every script of
  the bundles in `make build`), Stylelint and es-check enforce it. An API the code or a dependency
  needs is polyfilled in `src/platform/polyfills.ts` (run first, from
  `src/platform/install-polyfills.ts`) and named in `.browser-apis.json` (and in the `ignore` of
  `.escheckrc.json` when es-check knows it), never ignored otherwise.
- **The remote control is the only input**: arrows, Enter and Back (`keyCode` 10009 on Tizen, 461 on
  webOS, Escape and Backspace on the desktop). Every action is reachable with them; the focus is
  always visible (`:focus` styles) and never lost when a screen changes. Navigation logic (where the
  focus goes) is pure and lives in the core; key codes live in `src/platform`. One component listens
  to the keys at a time (the screen on top, or the viewer over it), through `useRemoteKeys`. Back on
  the first screen (the start screen, or the connecting and error screens before it) leaves the app
  through `src/platform/app-exit.ts` (`webOS.platformBack` or `PalmSystem.platformBack` on webOS,
  `tizen.application.getCurrentApplication().exit()` on Tizen, feature-detected; a browser stays):
  never trap people in the app. Tizen delivers arrows, Enter and Back without
  `tizen.tvinputdevice.registerKey`, and Back as the 10009 keydown (never also `tizenhwkey`, or one
  press acts twice). Info (457 on Tizen and webOS, I on a keyboard) opens the settings over the
  viewer, and presents from the photo in focus in "Todas"; Tizen only sends it once
  `src/platform/tizen-keys.ts` registers it at startup. It is a shortcut: Down opens the same
  settings, and Enter in the viewer starts the same presentation, so that the arrows, Enter and Back
  still reach everything.
- **Memory is scarce**: grids render only the rows on the screen and one around them (the rest is
  unmounted, its images unloaded), the viewer keeps at most three images decoded, and "Todas" reads
  the library a month at a time as the focus nears the end of what is read, never all of it. Only `transform`
  and `opacity` change, few elements animate, and nothing relies on `overflow`, which Chromium 68
  supports only in part: screens are `position: fixed` and off-screen cells are hidden.
- **Overscan**: every screen keeps its content inside the safe area, 5% of each edge. The book is
  the one exception: its paper reaches 3.5% of each edge, and the margins of its pages keep its
  photos inside the 5%; the layer of its controls stays inside the 5%.
- **The look** (CONTRIBUTING.md, "The look of the app"): the palette of the logo (neutral graphite
  with one soft amber accent, the `--gold` names; every text at a contrast of 4.5:1 or more, which
  `src/ui/palette.test.ts` checks) as custom properties of `src/ui/styles.css`, the only place a
  color is written: shades with transparency are `rgb(var(--name-rgb) / alpha)` of the channels
  declared there, never a loose value in a rule. Manrope 400, 600 and 700 for the whole interface,
  titles included, tabular figures where numbers count, and the italic of Playfair Display only for
  the captions and the title on the cover of the photo book, Latin-subset
  WOFF2 shipped in `src/ui/fonts`, OFL, `font-display: swap`; never a font or an image from the
  network but Immich's. Focus: an amber ring, one short glow and `scale(1.04)`; on the photos of the book, a thin amber
  ring and a faint glow alone, discreet on the paper, and none while the book plays. Only `opacity` and `transform` animate; glows stay on the
  focused element; darken with gradients, never `filter: blur` or `backdrop-filter` (Stylelint bans
  `blur()` and the individual `translate`, `scale` and `rotate` properties). The logo is drawn from
  `scripts/logo/mark.ts` (the app's icon and the TV icons too): run `make logo` after changing it,
  never edit its SVG files by hand. After a visual change, run `make screenshots` and commit `docs/screenshots/`.
- **Relative paths** (`base: './'`) and **no service worker**: the packaged apps load from `file://`.
- **No module script on webOS**: webOS serves `file://` without a MIME type, and its Chromium refuses
  a module script then (the owner's LG showed a grey screen). The webOS build
  (`vite.webos.config.ts`, into `build/webos-dist/`) is one classic script (`iife`) that `index.html`
  loads with `<script defer>`, without `crossorigin` (`scripts/webos/classic-script.ts`); es-check
  reads it as a script. The web build of `dist/` stays a module, and so does the Tizen package, which
  works on the Samsung's Chromium 85.
- **The webOS app** (`make package-webos`, `docs/webos.md`) loads from `file://`, another origin than
  Immich: its `config.json` holds the full address of the proxy, which answers CORS and adds the key.
  The packaging (`scripts/webos/`) refuses a relative `immichUrl` and any `apiKey`, takes the version
  from `package.json`, draws the icons (no committed images) and runs `ares-package --no-minify` on
  the webOS build, so the package holds the bundle es-check verified. `@webos-tools/cli` runs through `npx` at the version
  pinned in `scripts/webos/ares.ts`, never as a devDependency: its shrinkwrapped dependencies fail
  `npm audit`. `webos/appinfo.json` keeps `disableBackHistoryAPI: true`, or Back never reaches the app.
- **The Tizen app** (`make package-tizen`, `docs/tizen.md`) loads from `file://` too, with the same
  `config.json` rules (`scripts/packaging/`). The packaging zips the widget itself
  (`scripts/tizen/zip.ts`, deterministic) into an **unsigned** `.wgt`, with no Tizen tool: signing
  needs the owner's Samsung author and distributor certificates (the latter bound to the TV's DUID)
  and stays a manual step with the Tizen CLI. Never commit a certificate, a profile, a DUID or a TV's
  address. `tizen/config.xml` keeps `<access origin="*" subdomains="true"/>` and the `internet`
  privilege, or the app never reaches the proxy, and `tv.inputdevice`, for the Info key it
  registers; it asks for no other privilege.
- **Runtime configuration**: `config.json` next to `index.html` (`immichUrl`, the optional `apiKey`,
  `slideshowSeconds` and the `presentation` block of the defaults of the settings) is read on every
  start and never committed (`.gitignore`); `public/config.example.json` documents it. Its fields,
  and the names of the settings in the `presentation` block, are the public contract of every
  installation.
- **The photo book** is laid out by an algorithm, never from a fixed list of templates: the number
  of photos of each page (`src/core/book-pagination.ts`) and the arrangement of a page, an
  optimization over guillotine cuts scored by `src/core/page-layout.ts` (every photo whole, never
  cut nor stretched, a gap of 1.5% and a margin of 4% of the width of the page, a bounded search:
  past six photos, halves paired, at most `MAX_TRIED` arrangements a page). The shape of the page
  is a parameter (`pageAspect`, from the `bookFormat` setting: 8:9 pages, a 16:9 spread, by
  default; 4:3 for the classic book), never assumed. Pages are laid out when first shown, never the
  whole book at once. The book fills the screen; its controls (the title, the bar, the strip) are a
  layer over it, shown on Down from the last photo or Info, hidden by Back or after
  `hideInterfaceSeconds`, and absent while the book plays. What it makes is plain data (pages, rectangles, weights, seed); the
  seed of a reorganized book stays on the TV (`mirante.books`, `STORED_SEEDS_VERSION` in
  `src/core/book-seeds.ts`). The paper of its pages (`--paper`, `--ink`) stays neutral and warm,
  apart from the graphite and the amber. Its images are Immich's thumbnails and previews (a photo
  under 30% of the height of its page on its shorter side takes the thumbnail), at most two spreads
  decoded, the next one loaded ahead.
- **The settings of the presentations** stay on each TV in `localStorage` (`mirante.presentation`),
  with the version of their shape (`STORED_SETTINGS_VERSION` in `src/core/settings-storage.ts`):
  raise it when a reader of the old shape would misread the new one; anything unreadable falls back
  on the defaults. Their limits (3 to 60 seconds, 3 to 20 for the interface) hold whatever the
  source.

## Critical surfaces

A failure here can change or delete photos in the owner's library or expose the API key or the photos,
and a revert does not undo it. The `pr-writer` reads this list before assigning `risk:high` or
`risk:critical`. Touching these files does not make a PR critical by itself; what the change can break
does.

- **What reaches Immich** (`src/immich/`): only reads, with the key of `config.json` (when it has one)
  in the `x-api-key` header and never in a URL. A call that writes changes the library for good.
- **The API key**: read from `config.json` (`src/core/runtime-config.ts`,
  `src/platform/config-file.ts`), kept out of logs, messages, URLs and the repository; `config.json` is
  gitignored. The TV packages never carry one (`scripts/packaging/packaged-config.ts`).
- **What the TVs run**: the build target, the polyfills and the compatibility checks (`vite.config.ts`,
  `vite.webos.config.ts`, `.escheckrc.json`, `.browser-apis.json`, `scripts/browser-apis/`,
  `src/platform/polyfills.ts`, `src/platform/install-polyfills.ts`, `browserslist`,
  `stylelint.config.mjs`), and the
  TV packages (`webos/appinfo.json`, `tizen/config.xml`, `scripts/packaging/`, `scripts/webos/`,
  `scripts/tizen/`). A gap shows as a blank screen on the TV,
  where there is no developer at hand.

Usually high rather than critical: the fields of `config.json` (a rename breaks every installation
until its file is edited), and focus or key handling that can leave the remote control stuck.

## Before opening a PR (mandatory)

1. `make quality` passes. A PR with failing checks is not a PR.
2. `make build` passes when the change touches the app, its dependencies or the build.
3. `make mutation-changed` passes when the change touches `src/core`.
4. The fields of `config.json` are not removed or renamed unless the task asks for it.
5. The docs are updated if the change affects setup, commands, configuration, scope or architecture:
   the README for users, `CONTRIBUTING.md` for development, and `CHANGELOG.md` under `[Unreleased]`.
6. The PR follows `.github/pull_request_template.md` and carries exactly one `risk:<level>` label,
   assigned by judgment (see "Workflow" and "Critical surfaces").

## Deterministic validation

The pipeline started at zero: no baseline, no ignore list, no known violations. When a check fails,
change the code, never the check. Relaxing, removing or adding an exception to any threshold, rule or
contract needs the owner's explicit approval. The one committed baseline, `suppressions-baseline.json`,
is empty and only goes down.

- **ESLint**: typescript-eslint `strictTypeChecked` and `stylisticTypeChecked`, SonarJS, the security
  rules, `eslint-plugin-compat` and `mirante/browser-apis` on the app, the React and hooks rules on the components and the project
  rules in `eslint.config.ts`, every one an error, `--max-warnings 0`. The complexity limits (cyclomatic
  complexity 5 like xenon A, cognitive complexity 5, nesting depth 2, 30 lines per function, 3
  parameters, 300 lines per file) cannot be disabled inline: split the code. Any other `eslint-disable`
  needs a `-- reason`, `@ts-expect-error` needs a description and `@ts-ignore` is banned. Coverage and
  mutation pragmas (`v8 ignore`, `Stryker disable`) are rejected unless they come with a disable and
  its reason.
- **Stylelint**: `stylelint-config-standard` and `stylelint-no-unsupported-browser-features` against
  `browserslist`, every problem an error.
- **tsc 7**: `strict` plus `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noUnused*`, `erasableSyntaxOnly` and
  `verbatimModuleSyntax` (`tsconfig.base.json`), in four projects: the app (ES2018 and the DOM), the
  core alone (ES2018 only), the tests and the tooling (ES2025 and Node.js). TypeScript 6 is installed
  beside it (`typescript` is an npm alias of `@typescript/typescript6`) only because typescript-eslint,
  Stryker and dependency-cruiser still need its API: remove it once they support TypeScript 7.
- **Architecture**: `make lint-arch` enforces the rules above (`.dependency-cruiser.mjs`). If it fails,
  fix the import, not the contract.
- **Coverage**: 100% of statements, branches, functions and lines, as a ratchet (Vitest `autoUpdate`
  only ever raises the numbers in `vitest.config.ts`), components and the composition root included.
  Write the missing test or remove the unreachable code. Only the command-line entry points
  `scripts/*.ts` are excluded: CI runs them for real.
- **Build**: `make build` bundles with Vite into `dist/` (a module) and `build/webos-dist/` (a classic
  script), runs es-check on every script of both: ES2018 syntax (the webOS one parsed as a script),
  and no newer built-in but the polyfilled ones of `.escheckrc.json`; then
  `scripts/browser-apis.ts` on both: no global API, or member of one, that Chrome 68 lacks per MDN's
  browser data, but the polyfilled ones of `.browser-apis.json`.
- **Mutation testing** runs on every PR (`Mutation testing` workflow, only the `src/core` files changed
  in the diff) and weekly on the whole core. The job fails when the score is below `MUTATION_MIN_SCORE`
  (repository variable, default 95). Survivors are listed in the Quality Report and the job summary with
  file, line and mutator: add the missing assertion; never weaken or delete tests, shrink the `mutate`
  scope or lower the ratchet. Never commit `reports/` or `.stryker-tmp/`.
- **Dead code**: knip reports unused files, exports, dependencies and stale configuration. Delete the
  unused code; do not add `ignore*` entries to `knip.jsonc`.
- **Suppressions**: `make suppressions` (`scripts/suppressions.ts`, in `make quality`, the pre-commit
  hook and the `lint` job) counts per file and kind every `eslint-disable` and inline `/* eslint */`
  config, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `v8`/`c8`/`istanbul ignore`,
  `Stryker disable`, `prettier-ignore`, the JSDoc tags knip skips (`@public`, `@beta`, `@alias`,
  `@internal`) and every skipped, failing or focused test (`.skip`, `.skipIf`, `.runIf`, `.todo`,
  `.fails`, `.only`, `xit`, `fit`, `context.skip()`...) in every source file git tracks or would add,
  and compares them with `suppressions-baseline.json`. A new suppression fails the check: fix the cause.
  Raising the baseline (`npm run suppressions:update -- --allow-increase`) needs the owner's explicit
  approval. When you remove suppressions, run `make suppressions-update` and commit the lower baseline
  in the same PR.
- **Risk label**: the `Risk label` workflow fails a PR without exactly one known `risk:<level>` label
  (`low`, `medium`, `high`, `critical`). The level is a judgment (`.claude/agents/pr-writer.md`, step 5),
  not derived from the files a PR touches. Do not change pipeline files unless the task asks for it,
  and call the change out in the PR.

## Workflow

1. **Implement**: code changes are delegated to the `coder` agent (`.claude/agents/coder.md`), which
   creates a branch, implements, commits (one commit per logical step), pushes and writes the handoff
   notes. It does not open the PR and does not assess the risk. Never commit directly to `main`.
2. **Describe and open**: then delegate to the `pr-writer` agent (`.claude/agents/pr-writer.md`) with the
   original task verbatim, the branch, the base branch and the path of the handoff notes. It reads the
   diff cold, commit by commit, fills `.github/pull_request_template.md`, assigns the risk level (mostly
   low or medium; high or critical only with a sentence naming what can break; at least medium when there
   are deploy steps), opens the PR with the `risk:<level>` label and stops. It never writes code. The
   body is short: a standalone summary of one or two sentences, at most one visual block (a before/after
   table in plain words, a small Mermaid diagram or a short diff), a single Deploy line only when there
   is a real release step, and a risk line only for high or critical. It still checks every claim
   against the diff and the tests.
3. **Fallback**: if `pr-writer` fails or cannot run, delegate back to `coder` saying so: it opens the PR
   itself with a minimal body (a summary in the template's shape, risk "unassessed", no risk label),
   so a failure never blocks delivery. The `Risk label` check stays red until a person sets the label.
4. **Merge**: nobody but the owner merges. Agents never merge, approve or enable auto-merge.

- **Exception**: if a `.local_dev` file exists at the repository root, the developer is working locally:
  edit files directly, without delegating to `coder` or `pr-writer` and without creating commits or PRs.
- Use the `reviewer` agent (`.claude/agents/reviewer.md`) to review a branch against these rules before
  merging.

### Handoff notes

The `coder` writes them to `.handoff/<branch>.md` (every `/` of the branch name replaced with `-`; the
directory is gitignored) after pushing. `pr-writer` checks them against the diff and reports a
**Divergence** line when they disagree. Sections, in this order:

- `## Task`: the original task, verbatim.
- `## Done`: what changed and why, one line per item.
- `## Decisions`: choices made, alternatives rejected, conservative options taken on non-blocking doubts.
- `## Deploy notes`: release needs (repository variables or secrets, labels, the `CHANGELOG.md` entry,
  a new `config.json` field, external configuration such as the Immich server or a reverse proxy); or
  "None".
- `## Not verified`: everything the author did not or could not check, and why; or "nothing".

## Personal preferences

> These are the personal preferences of the project owner, taken from py-awesome-template. Everything
> above this section describes how the project works; everything below is taste.

- **New standards**: whenever the user asks to change a code pattern, ask whether it should become a
  project standard. If yes, add it to this list so it is followed in every future conversation.
- **Reuse first (YAGNI)**: follow the existing pattern instead of inventing one. Before creating a
  function, module, interface, component or dependency, check whether one already exists and reuse it.
  When you change shared code, find and update every caller.
- **Single responsibility**: each module has one reason to change. If a module needs to import from two
  unrelated integrations, extract the dependency to an intermediary.
- **SOLID beyond SRP**: open for extension, closed for modification; depend on interfaces declared by
  the core and receive dependencies as parameters (props for components). Injected dependencies are
  mandatory: no optional parameter with a hidden default implementation.
- **DDD**: invariants, calculations and state transitions live in the core as pure functions or
  methods of its types, with no I/O. Components render state and forward events.
- **Index files**: only create an `index.ts` when it actually re-exports symbols. Never create empty
  placeholder files to mark folders (an empty folder keeps a `.gitkeep`).
- **Comments and docs**: no JSDoc/TSDoc on functions, methods or classes. Comments only when the code
  is genuinely confusing or the reason is not obvious from the names. Never comment what the code does.
- **Identifiers**: every identifier in English. Booleans start with `is`, `has`, `should` or `can`
  (enforced). Never prefix a class name with `_`.
- **Language**: code, comments, logs, docs and CI reports in English. The text people read on the screen
  is Brazilian Portuguese and lives only in `src/ui/messages.ts` (and its companions
  `settings-messages.ts` and `book-messages.ts`).
- **Typing**: every function declares its return type (enforced). No `any`: use `unknown` and narrow
  it. Values from outside (`config.json`, server responses, `JSON.parse`) are validated where they
  enter the code.
- **Fixed sets of strings**: an `as const` object plus the union of its values
  (`export const Status = { Ok: 'ok' } as const` and
  `export type Status = (typeof Status)[keyof typeof Status]`). Never a TypeScript `enum` (enforced:
  it is not erasable syntax) and never string literals spread across the code.
- **Data structures**: interfaces with `readonly` fields for structured data; `Map`/`Set` for
  collections keyed by data (ids, names), never a plain object indexed by a variable.
- **No magic values**: limits, timeouts, truncations and URLs are named `UPPER_CASE` constants at the
  top of the module (enforced for numbers). Constant collections are `readonly` arrays or
  `ReadonlySet`/`ReadonlyMap`.
- **Dates**: never depend on the time zone of the machine without meaning to; show photo dates as
  Immich reports them.
- **Edge cases**: before implementing, list the states and input values that can reach the code (a
  missing or invalid `config.json`, a slow or absent server, an empty album, a key pressed twice) and
  handle each one.
- **Idempotency**: repeating the same action (a key held down, a double Enter, a retried request)
  never duplicates an effect.
- **Fail loudly**: never swallow errors (no empty `catch`). Catch specific errors only where something
  can be done; log unexpected errors and rethrow or translate them. Only best-effort side effects may
  continue, after logging.
- **Nothing internal leaks**: messages are written for people, in Portuguese: no stack traces, status
  codes or internal ids on the screen.
- **Security**: never put the API key or personal data in logs, error messages, URLs or the
  repository. Never inject HTML from data (no `dangerouslySetInnerHTML`). Compare secrets in constant
  time.
- **No telemetry, ever**: no analytics, crash reporting or network calls other than the user's own
  Immich server and the app's own files.
- **Logging**: never `console` in `src/` (enforced) except through `src/platform/error-log.ts`.
- **Configuration**: read `config.json` through `src/platform/config-file.ts` only.
- **Functions**: small; a short orchestrator composes verb-named helpers. Prefer guard clauses and
  early returns over nested `if`s. Many optional parameters go in an options object.
- **Dependencies**: always use the latest available version of any external library. The exceptions
  and their reasons live in `.github/dependabot.yaml`. Every runtime dependency counts against the
  TVs' memory and the ES2018 floor: prefer none.
- **README**: after any relevant change (new screen, key, configuration field, setup step or
  architecture change), check whether the README needs updating and update it.
- **Tests**: `describe` the unit, name each case `it('should <behaviour>')` and call the object (or
  the result) under test `sut`. Mock only the external boundary (the Immich server and `config.json`
  through MSW, the console, the clock); never mock the project's own modules.
- **Commits**: Conventional Commits in English: `<type>: <short description>`, with `feat`, `fix`,
  `refactor`, `chore`, `test`, `docs`, `ci` or `build` (the commit-msg hook enforces it).
