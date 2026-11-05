# Changelog

All notable changes to Mirante are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Mirante follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **The webOS app opened to a grey screen on the owner's LG (Chromium 68).** webOS refused the
  bundle, a module script, from the TV's file system ("non-JavaScript MIME type of ''"), and once
  loaded the bundle stopped on `queueMicrotask`, which Preact calls and Chromium only has since 71.
  `make build` now also bundles the app as one classic script into `build/webos-dist/`, loaded with
  `<script defer>` and without `crossorigin`, which `make package-webos` packages; the web build in
  `dist/` and the Tizen app are unchanged. `queueMicrotask` is polyfilled next to
  `Object.fromEntries`, before any other module runs.
- **The checks now see the runtime APIs, not only the syntax.** `make lint` and `make build` check
  every global API the code reaches, the bundled dependencies included, against MDN's browser data
  for Chromium 68 (`scripts/browser-apis/`, `.browser-apis.json` for the polyfilled ones), and
  `make test-webos` runs the package in a headless Chromium that refuses module scripts and lacks the
  polyfilled APIs, as the LG does. [docs/webos.md](docs/webos.md) records the two errors and how to
  debug the TV with `ares-inspect` and the Chrome DevTools Protocol.

### Added

- **The identity of Mirante.** A logo, an M standing on the horizon under the arch of a rising sun
  over two lines of water, drawn from its shapes by `make logo` (`scripts/logo/`): the mark the app
  shows, and an icon and a horizontal logo with the name MIRANTE in `docs/logo/`. The webOS and
  Tizen icons are now that mark, rasterized from the same shapes.
- **A new look for every screen**: a warm near-black palette with golds, titles, album names, years,
  months and dates in Playfair Display (shipped with the app, Latin subset, about 44 KB, OFL), an
  opening with the logo while the app connects (it never delays the gallery), a start screen with
  the logo, two large cards with icons and the cover of the most recent album darkened behind them,
  cards with soft corners, a golden focus ring that grows a little, a viewer with a vignette, the
  date in gold and a thin golden line during the slideshow, and loading, empty and error states
  under the small mark, with warmer words. Screens fade in; the viewer crossfades in 600 ms. Only
  opacity and transform animate, and nothing is blurred, for the TVs' GPUs.
- **`make screenshots`**: the main screens at 1920x1080 from a headless Chromium against a fake
  Immich, written to `docs/screenshots/` as WebP for reviewing the look.

- **The Samsung Tizen app.** `make package-tizen` turns the build into an **unsigned**
  `build/tizen/Mirante.wgt` (and the folder `build/tizen/widget/` it is made from), zipped by the
  packaging script itself: the bundle as `make build` checked it, `tizen/config.xml` (the widget
  `MirantTV01.Mirante`, Tizen 6.5, access to any origin and the `internet` privilege only) with the
  version of `package.json`, a 117x117 icon drawn by the same script as the webOS icons, and a
  `config.json` from `tizen/config.json` or `MIRANTE_IMMICH_URL`, with the full address of the proxy
  and no API key. The owner signs it with the Tizen CLI and his own Samsung certificates, which list
  the TV's DUID, before installing it. `make test-tizen` runs the package from `file://` in a
  headless Chromium against a fake Immich. [docs/tizen.md](docs/tizen.md) covers Developer Mode,
  the certificates and signing, installing, opening and debugging the app on the TV.
- **Back leaves the app on its first screen on Tizen** too
  (`tizen.application.getCurrentApplication().exit()`).
- **The LG webOS app.** `make package-webos` turns the build into
  `build/webos/com.mathmed.mirante_<version>_all.ipk` with LG's `ares-package`: the bundle as
  `make build` checked it, `webos/appinfo.json` with the version of `package.json`, the 80x80 and
  130x130 icons drawn by the packaging script, and a `config.json` from `webos/config.json` or
  `MIRANTE_IMMICH_URL`, which must hold the full address of the proxy and no API key. The proxy in
  front of Immich must answer CORS for it. `make test-webos` runs the package from `file://` in a
  headless Chromium against a fake Immich. [docs/webos.md](docs/webos.md) covers Developer Mode
  and installing, opening and debugging the app on the TV.
- **Back leaves the app on its first screen** when it runs on a webOS TV (`platformBack`), from the
  start screen and from the connecting and error screens; in a browser it stays.

- **The gallery.** A start screen with **Álbuns** and **Linha do tempo**; the albums with their
  covers, names and photo counts; the photos of an album in the order chosen in Immich; the timeline
  by year, then by month, then the month's photos; and a full-screen viewer with the previous and
  next photo on the arrows and a slideshow on Enter (in a loop, preloading the next photo), whose date
  and counter fade away by themselves. Back returns to the previous screen with the focus where it
  was. Loading, empty and error states in Portuguese, with the button already focused.
- **Remote control navigation**: arrows, Enter and Back (10009 on Tizen, 461 on webOS, Escape and
  Backspace on the desktop), with spatial focus navigation in grids of any number of columns.
- **Built for the TVs' memory**: grids render only the rows on the screen, thumbnails in the grids and
  previews in the viewer (never the originals), at most three images decoded in the viewer, and
  every screen inside the overscan safe area.
- **`slideshowSeconds`** in `config.json`: the interval of the slideshow, 8 seconds by default.

- **The project skeleton.** A start screen reads `config.json` next to the app, connects to the Immich
  server it names and shows the server's address and Immich version, or explains in Portuguese what
  is wrong (no configuration, an invalid field, a server that does not answer, a rejected key) with a
  focused button to try again.
- **The quality pipeline**: strict ESLint, Stylelint and tsc, 100% coverage, architecture contracts,
  dead code and vulnerability checks, the suppression ratchet, mutation testing of the core, the
  build checked against ES2018 for the TVs, the Quality Report and the risk label.

### Changed

- **The start screen reads the albums** once per visit, for the photo behind it; a failure there only
  goes to the log and leaves the background plain.
- **Stylelint rejects `blur()`** and the individual `translate`, `scale` and `rotate` properties,
  which Chromium 68 lacks and its data misses.
- **Mirante is served at the address of Immich**, behind a proxy that sends `/api` to it: `immichUrl`
  may be relative (empty or a path), and `apiKey` is optional, for a proxy that adds the key itself
  (which is what lets the images load). Without a key, none is sent.
- **`@immich/sdk` is pinned to 3.3.6**, the version of the owner's server, and bumped by hand with it.
