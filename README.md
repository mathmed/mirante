# Mirante

A photo gallery viewer for TVs. Mirante runs in the TV's browser (and later as an app of the TV),
reads the photos of your [Immich](https://immich.app/) server and is driven by the remote control
alone: arrows, Enter and Back.

> **Status: skeleton.** This version connects to Immich and says which server it reached, or what is
> wrong. The gallery screens (albums, timeline, photo viewer, slideshow) come next.

## Scope

Version 1 shows photos, read only:

- albums and the timeline of the library, and a full-screen photo viewer with a slideshow;
- navigation with the remote control only, with the focus always visible;
- a runtime configuration file, so that the same build serves any Immich server.

Out of scope on purpose: video, people, search, upload, editing and anything else that writes to
Immich. Mirante never changes your library.

## Supported TVs

| TV                                 | Platform              | Browser engine |
| ---------------------------------- | --------------------- | -------------- |
| Samsung QN65Q60B (2022)            | Tizen 6.5             | Chromium ~85   |
| LG (any webOS with Chromium 68 up) | webOS 5.0 and later   | Chromium 68 up |
| Desktop browsers, for development  | Chrome, Edge, Firefox | current        |

Chromium 68 is the floor, and the build enforces it: the bundle targets ES2018 and is checked with
es-check, TypeScript only knows the ES2018 built-ins, ESLint rejects web APIs Chromium 68 lacks
(`structuredClone`...) and Stylelint rejects CSS it lacks (`:has`, `aspect-ratio`, `gap` in flexbox,
`:focus-visible`...). The one built-in a dependency needs beyond that, `Object.fromEntries`, is
polyfilled. Assets load through relative paths and there is no service worker, so the same `dist/`
works from a web server or, later, packaged as a Tizen `.wgt` and a webOS `.ipk`.

### Remote control

| Key        | Tizen | webOS | Desktop (to simulate) |
| ---------- | ----- | ----- | --------------------- |
| Arrows     | 37–40 | 37–40 | arrow keys            |
| Enter / OK | 13    | 13    | Enter                 |
| Back       | 10009 | 461   | Escape or Backspace   |

The focus is always visible, and every screen is reachable with these keys only. In this skeleton
the only control is the **Tentar novamente** button of the error screen, which takes the focus by
itself; spatial navigation between photos comes with the gallery.

## Configuration

Mirante reads `config.json` from the folder of its `index.html` when it starts:

```json
{
  "immichUrl": "http://192.168.0.10:2283",
  "apiKey": "a-read-only-immich-api-key"
}
```

- `immichUrl`: the address of the Immich server as the TV reaches it, with `http://` or `https://`
  and without `/api` at the end.
- `apiKey`: an Immich API key (**Account Settings → API Keys** in Immich). Create one only for
  Mirante, with read permissions only.

Copy [`public/config.example.json`](public/config.example.json) to `public/config.json` for
development, or to `config.json` next to `index.html` in `dist/` for an installation. `config.json`
is ignored by git at any level: **never commit it**. The file is read again on every start (and on
**Tentar novamente**), so fixing it needs no rebuild.

### Reaching Immich

The TV must reach the Immich server (same network, or Tailscale). Immich does not send CORS headers
outside its development mode, so a browser blocks Mirante's requests when Mirante is served from
another origin than Immich: serve both under the same origin (a reverse proxy that sends `/api` to
Immich and the rest to `dist/`), or add the CORS headers in the proxy in front of Immich. Mirante
reports a blocked request as "O Immich não respondeu".

## Running it

You need Node.js 24 and npm.

```sh
make setup    # locked dependencies and the git hooks
make dev      # http://localhost:5173, with public/config.json
make build    # dist/: the app the TVs load, checked against ES2018
```

Serve `dist/` (plus its `config.json`) with any static web server and open it in the TV's browser.

## Why Preact

The TVs have little memory and old engines. Preact keeps React's component and hooks model at a
fraction of its weight (about 5 kB gzipped against about 60 kB for React 19 with `react-dom`), has no
dependency, and its output runs on engines much older than Chromium 68. The whole app, Immich SDK
included, is about 16 kB gzipped today.

## Architecture

```
src/core/      pure logic, no DOM and no package: the startup flow, the runtime configuration, the
               photo library interface and its domain types
src/immich/    the photo library implemented with @immich/sdk, read only
src/platform/  what differs between TVs and browsers: config.json, polyfills, the console
src/ui/        Preact components and every user-facing text (Brazilian Portuguese)
src/main.tsx   composition root: wires the adapters into the UI
test/          test support: the fake Immich server (MSW) and throwaway git repositories
scripts/       CI tooling: Quality Report, suppression ratchet, mutation runner, risk label check
```

The layers are enforced by dependency-cruiser; [`CLAUDE.md`](CLAUDE.md) has the full rules and
[`CONTRIBUTING.md`](CONTRIBUTING.md) the development workflow and the quality pipeline.

## License

[MIT](LICENSE) © 2026 Mateus Medeiros de Araujo
