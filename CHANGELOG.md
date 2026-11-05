# Changelog

All notable changes to Mirante are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Mirante follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

- **Mirante is served at the address of Immich**, behind a proxy that sends `/api` to it: `immichUrl`
  may be relative (empty or a path), and `apiKey` is optional, for a proxy that adds the key itself
  (which is what lets the images load). Without a key, none is sent.
- **`@immich/sdk` is pinned to 3.3.6**, the version of the owner's server, and bumped by hand with it.
