# Changelog

All notable changes to Mirante are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Mirante follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **The book fills the screen.** The spread takes the whole safe area (3.5% of each edge for the
  paper alone; the margins of the pages keep the photos inside the 5% of the other screens), in
  pages of 8:9 that make a 16:9 spread, the shape of the TV. The title, the logo, the labels
  "Página N", the bar of buttons, the strip of spreads and the keys no longer take room under the
  spread: they are a layer over the book, shown by ↓ from the last photo of the spread or by Info,
  hidden by Back or after the time of **Esconder a interface após**. The number of each page is now
  small, in the outer lower corner of its paper (still behind **Mostrar os números das páginas**).
  ← and → turn the page from any photo; ↑ and ↓ go from photo to photo, the nearest one that way,
  under a thin amber ring. **Reproduzir livro** shows the pages alone with a thin amber line at the
  bottom, and any arrow or OK pauses it and shows the controls. The layout engine takes the shape
  of the page as a parameter, and its margin goes from 6% to 4% of the width of the page and its gap
  from 2% to 1.5%, for larger photos: the books laid out before look different, with the same seeds.
  A photo whose shorter side takes under 30% of the height of its page loads the thumbnail (40%
  before), a larger one the preview. The screenshots of the book are taken again, with the controls
  shown and hidden, in both formats, at 1920x1080 and 1280x720.
- **A modern identity: graphite with a soft amber accent.** The warm near-black and golds give way
  to neutral graphite (background `#0C0C0E`, surfaces `#17171B` and `#222228`) with one amber
  (`#F0B65A`), every color set once in `src/ui/styles.css`, and every text at a contrast of 4.5:1 or
  more, checked by a test. The whole interface, titles included, is set in Manrope (400, 600 and
  700, shipped with the app, OFL), with tabular figures on counters and counts; Playfair Display
  keeps only its italic, for the captions of the photos. Cards have round corners (20 to 28 px) on
  two levels of graphite, the line icons are redrawn with a stroke of 2 and round ends, the focus is
  an amber ring with one short glow and a growth to 1.04, and the name no longer shows in wide
  uppercase. The viewer keeps a thin amber progress line, the date in the secondary text and a
  subtler vignette. The fonts weigh about 64 KB, against 44 KB before.
- **A new icon and logo.** A rounded graphite square with a diagonal gradient, and in its middle an
  amber mark: two rounded peaks in one stroke that make a geometric M, and the sun, a dot above the
  right one. The horizontal logo sets the mark beside the name in lowercase Manrope semibold. The
  opening now shows the icon appearing by opacity and a short scale. `make logo` writes the app's
  mark and icon and `docs/logo/`; the webOS and Tizen icons are drawn from the same shapes, so the
  TV packages need building again (`make package-webos`, `make package-tizen`; a signed Tizen
  package needs signing again). `docs/screenshots/icone-alternativas.webp` compares the icon with
  the two alternatives it was chosen against, which nothing ships.
- **The start screen has five cards**: **Todas**, **Álbuns**, **Linha do tempo**, **Apresentar** and
  **Ajustes**, and opens on **Todas**. The line "Suas memórias, vistas do alto" is gone, for the
  count of the library. The card **Linha do tempo** gets a clearer icon, a page of the calendar.
- **Counts of photos group their thousands with a dot** ("1.234 fotos"), on the albums too.
- **The proxy needs two more routes, and one more CORS header for the TV apps.** The presentation
  of the whole library draws its photos with `POST /api/search/random` (a read, with a JSON body)
  and the captions come from `GET /api/assets/{id}`. A proxy that only lets through the routes the
  app used before refuses them: the library does not present and no caption shows. Allow both, and,
  for the packaged apps, answer the preflight with `Access-Control-Allow-Headers: Content-Type`.
  [docs/proxy.md](docs/proxy.md) lists every route and method, what stays forbidden, and a Caddyfile.
- **`slideshowSeconds` is now the default interval of the settings**, brought within their 3 to 60
  seconds (it still accepts up to 3600, so no file breaks); `presentation.intervalSeconds` wins over
  it.
- **The viewer**: the date, the keys and the counter move to the top of the screen, to leave the
  bottom to the caption, and its hint names ↓ for the settings.
- **The photos of an album and of a month open on their first photo**, after the new tile that
  opens them as a book; **Apresentar** offers six cards, the two books included. Playfair Display's
  italic also sets the title on the cover of a book.
- **The Tizen app asks for the `tv.inputdevice` privilege**, to receive the Info key of the remote
  control (registered at startup). A signed package needs signing again with it.

### Fixed

- **The settings no longer run off the screen.** The list of **Ajustes** was taller than the screen,
  and its last rows (the book's and **Restaurar padrões**) could be neither seen nor reached. The
  list now moves with the focus, by `transform` alone with a short transition, so that the row in
  focus is always whole inside the safe area, under the title, which stays put; the rows not whole
  in view hide, and a thin bar beside the list shows where you are. The rows are grouped under
  small titles, **Apresentação**, **Livro** and **Geral**, which ends on **Restaurar padrões**:
  **Esconder a interface após** and **Reduzir efeitos** moved to **Geral**, after the book's.
- **The book fits a 1280x720 screen.** The keys under the strip stay inside the safe area at
  1280x720, and the miniatures of **Visão geral** are sized by the height of the screen, whatever
  the shape of the book, so that they no longer overflow their cards there.

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

- **Todas**, every photo of the library, the most recent first, like the "Recents" of a phone: one
  continuous grid with the name of each month and its count above its photos ("Novembro de 2026 ·
  312 fotos"). It reads the months from the most recent one, one at a time, as the focus nears the
  end of what is read, and only renders the rows on the screen and one around them. The viewer goes
  through the whole library in the same order, reading the next month ahead of it; Back returns to
  the photo it showed last. Info, or a second OK in the viewer, presents from the photo in focus,
  in the order of the screen. It reads the routes the timeline already uses
  (`GET /api/timeline/buckets` and `GET /api/timeline/bucket`): the proxy needs no change.
- **What the library holds, under the logo**, counted from the months of the timeline: "12.340
  fotos · de 2019 a 2026", "1 foto · de 2026". Nothing shows while it loads, for an empty library or
  when the read fails. Like Immich, the count of a month includes its videos.
- **An album or a month as a photo book.** **Ver como livro**, the first tile of an album or a
  month (and **Livro de um álbum** and **Livro de um mês** on **Apresentar**), shows its photos in
  spreads of two pages, several photos on each, on warm white paper with the fold shaded, the
  number of each page above it and an optional cover (the name and the period, the name in the
  italic serif). The layout is dynamic, never a fixed list of templates: how many photos a page
  takes follows the shapes and the number of the photos and a rhythm of light and full pages, and
  where they go is an optimization over the guillotine cuts of the page (sizes drawn from the shapes
  of the photos), scored on the room the photos fill, every photo whole and never stretched, a
  constant gap, a margin of 6% of the page, no tiny photo and no arrangement repeated on the next
  page; the result is plain data (pages, rectangles, weights, seed), in `src/core`. A seed makes the
  same book every time; **Reorganizar** draws another, kept on the TV for that album or month
  (`localStorage`, `mirante.books`). Pages are laid out as they are first shown, so a large album
  opens at once. Under the spread, a bar (‹, **Reproduzir livro**, **Visão geral**, **Reorganizar**,
  ›) and a strip of the spreads; the page turns by a short slide and a crossfade; OK opens a photo
  full screen and Back returns to its spread; **Reproduzir livro** turns a spread every few seconds.
  Small photos load Immich's thumbnails and large ones its previews, never the original, and at
  most two spreads are kept decoded. No new route of Immich.
- **Four settings for the book**, on **Ajustes** and in the `presentation` block of `config.json`:
  `bookDensity` (`"light"`, `"normal"` or `"dense"`), `showBookCover`, `showPageNumbers` and
  `bookSpreadSeconds` (3 to 60, 10 by default).
- **Formato do livro**, a setting on **Ajustes** and `bookFormat` in the `presentation` block of
  `config.json`: `"wide"` (**Tela cheia (16:9)**, the default) or `"classic"` (**Clássico (4:3)**,
  the pages of 4:3 the book had first). A new field: no `config.json` needs editing, and settings
  stored by an older version keep the default.
- **Three more screenshots**: a book on its cover, two pages laid out differently, and its overview.
- **Presentations.** The start screen gets **Apresentar**: the whole library, at random, 200 photos
  a round drawn by Immich and a new draw for each round; or an album, a year or a month, chosen on
  the screens of the gallery. A presentation plays at once, in the order and with the transition of
  the settings; Back returns to where it was chosen. The engine is pure logic in `src/core`: the
  playlist of a source, a random order from a seed that never repeats a photo before the round
  ends (nor across rounds), the next slide and when it comes, and what loads ahead (the next photo,
  decoded, and the one after it, only downloaded; never more than three decoded). Each slide holds a
  list of photos, one today.
- **Transitions**: a cut, a fade, a slide, or a slow "Ken Burns" zoom whose direction each photo's
  id decides, gentle or normal; only `opacity` and `transform` move. **Reduzir efeitos** leaves a
  plain fade without zoom, for slow TVs.
- **Captions**: the description of the photo in Immich, under it, in the golden italic serif,
  fading in. It is read for the photo on the screen and the next one only, with a small cache; a
  photo without one shows nothing and nothing moves.
- **Ajustes**, the settings of the presentations, from the start screen or over the viewer (Info,
  457 on Tizen and webOS, I on a keyboard, or Down): the interval (3 to 60 seconds), the order (by
  date either way, or random), the transition, the zoom, whether the date, the caption and the
  counter show, the loop, when the interface hides (3 to 20 seconds) and the lighter mode, with a
  sentence on what each value does and **Restaurar padrões**. Back keeps them on the TV
  (`localStorage`, versioned; anything unreadable is dropped for the defaults).
- **`presentation`** in `config.json`: the defaults of those settings for every TV (see the
  README). An invalid block is reported on the screen.
- **More screenshots**: the choices of a presentation, the settings, the settings over a photo, and
  the viewer with a caption.

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
