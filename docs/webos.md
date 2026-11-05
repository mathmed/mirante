# Mirante on an LG webOS TV

Mirante can be installed on an LG TV as a webOS app (`.ipk`), so it opens from the TV's launcher
instead of its browser. This page explains how to build the package, how to put the TV in
Developer Mode, and how to install, open and debug the app with LG's webOS CLI.

> The first package was installed on the owner's LG, whose webOS runs **Chromium 68**, and showed a
> grey screen; [What the LG taught us](#what-the-lg-taught-us) explains the two causes and the fix.
> The package is checked by `make test-webos` in a headless Chromium made to look like that TV (see
> [Testing the package](#testing-the-package)), not on a webOS device.

## How the packaged app reaches Immich

The app installed on the TV loads from the TV's file system (`file://`), not from the reverse proxy
in front of Immich, so it is never on the same origin as Immich:

- `immichUrl` must be the **full address of the proxy**, such as `http://192.168.0.10:8085`. A
  relative address (empty or a path) cannot work there, and packaging refuses it.
- The proxy must answer **CORS** for the app: `Access-Control-Allow-Origin: *`, a `204` to the
  preflight `OPTIONS`, and the methods `GET`, `HEAD`, `POST` and `OPTIONS`. Mirante sends no custom
  header and no cookie.
- The proxy adds the **API key** to the requests it sends to Immich, as for the browser install. The
  package never carries a key: packaging refuses a configuration with `apiKey`, because anyone with
  the `.ipk` could read it.
- The photos load as plain images (`<img src>`) from the same address, which needs no CORS.

## What you need

- Node.js 24 and npm, with the dependencies installed (`make setup`).
- Network access the first time you package: the webOS CLI comes from npm (see below).
- An LG TV on the same network as the proxy, and an LG developer account for Developer Mode.

### The webOS CLI

Mirante uses LG's [webOS CLI](https://github.com/webos-tools/cli) (`@webos-tools/cli`). It is **not
a devDependency** of the project: every release ships an `npm-shrinkwrap.json` that pins
dependencies with known vulnerabilities, which npm `overrides` cannot replace, so `npm audit` (part
of `make quality`) would fail. Instead:

- `make package-webos` runs `ares-package` through `npx` at a pinned version
  (`WEBOS_CLI` in `scripts/webos/ares.ts`, 3.2.6 today); npm downloads it to its cache the first
  time. Bump that version by hand: Dependabot does not see it.
- For the commands that talk to the TV, install the same version globally:

  ```sh
  npm install --global @webos-tools/cli@3.2.6
  ares --version
  ```

  or prefix each command with `npx --package=@webos-tools/cli@3.2.6`. The CLI runs on Node.js 24.

## Building the package

1. Write the configuration of the package. Either copy the example and fill it in:

   ```sh
   cp webos/config.example.json webos/config.json   # gitignored: never commit it
   ```

   ```json
   {
     "immichUrl": "http://192.168.0.10:8085",
     "slideshowSeconds": 8
   }
   ```

   or set the address in the environment, which wins over the file (the file is then not read):

   ```sh
   export MIRANTE_IMMICH_URL=http://192.168.0.10:8085
   ```

2. Package:

   ```sh
   make package-webos
   ```

   It runs `make build`, which also bundles the webOS build into `build/webos-dist/` (one classic
   script, see below; checked against ES2018 and the browser APIs of Chromium 68), lays out
   `build/webos/app/` with that build, `appinfo.json`, `config.json` and the icons, and writes
   `build/webos/com.mathmed.mirante_<version>_all.ipk`. It then reads the package back and fails
   unless it holds exactly those files, and lists them.

What goes into the package:

| File                    | Where it comes from                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `index.html`, `assets/` | `build/webos-dist/`, byte for byte: `ares-package` runs with `--no-minify`, so it does not minify again |
| `appinfo.json`          | `webos/appinfo.json`, plus the `version` of `package.json`                                              |
| `config.json`           | `MIRANTE_IMMICH_URL`, or `webos/config.json`                                                            |
| `icon.png`              | 80x80, drawn by `scripts/packaging/icon.ts` (no image is committed)                                     |
| `largeIcon.png`         | 130x130, drawn the same way                                                                             |

`webos/appinfo.json` declares the app (`com.mathmed.mirante`, a `web` app opening `index.html` at
1920x1080). It has no `version`: the version is always the one of `package.json`. It sets
`disableBackHistoryAPI`, so that Back reaches the app: Back returns one screen at a time, and on
the start screen (or the connecting and error screens before it) it leaves the app through the
TV's `platformBack`. `requiredACG` is empty because Mirante calls no webOS service.

The configuration is inside the package: to change the address, package and install again.
Packaging stops with a message in Portuguese when the configuration is missing, is not JSON, has
a relative `immichUrl` or has an `apiKey`.

## Turning on Developer Mode on the TV

Apps outside the LG Content Store only install in Developer Mode:

1. Create an LG developer account at
   [webostv.developer.lge.com](https://webostv.developer.lge.com/) (it is free).
2. On the TV, open the **LG Content Store**, search for **Developer Mode** and install it.
3. Open **Developer Mode** and sign in with the developer account.
4. Turn **Dev Mode Status** on. The TV restarts.
5. Open **Developer Mode** again and turn **Key Server** on. Write down the TV's IP address and the
   passphrase the app shows: the CLI needs them once.

**The Developer Mode session expires.** The Developer Mode app shows how much time is left; when it
runs out, Developer Mode turns off and the apps installed through it may be removed. Open the app
and press **Extend** from time to time, before the time runs out. Once the TV is set up in the CLI
(below), `ares-device --device tv --session-info` also shows the time left.

## Setting up the TV in the CLI

Register the TV once (`<tv-ip>` is the address shown by the Developer Mode app):

```sh
ares-setup-device
```

Choose **add**, then give it a name (`tv` below), the TV's IP address, port `9922` and the user
`prisoner`; leave the rest as proposed. Then fetch the key of the TV, with Key Server on, and type
the passphrase when asked:

```sh
ares-novacom --device tv --getkey
ares-device --device tv --system-info     # checks the connection
```

`ares-setup-device --list` shows the registered devices.

## Installing and opening the app

```sh
ares-install --device tv build/webos/com.mathmed.mirante_0.0.0_all.ipk
ares-launch --device tv com.mathmed.mirante
```

The app also appears in the TV's launcher as **Mirante**. To install a new package, run
`ares-install` again; to remove the app:

```sh
ares-install --device tv --remove com.mathmed.mirante
```

## What the LG taught us

The owner's LG runs webOS with **Chromium 68**, the oldest engine Mirante supports (the Samsung in
the living room runs Chromium 85). The first `.ipk` opened to a grey screen, for two reasons the
console showed one after the other:

1. **`Failed to load module script: The server responded with a non-JavaScript MIME type of ''`.**
   Vite loads the bundle with `<script type="module" crossorigin>`. webOS opens the app from
   `file://` and gives its files no MIME type, and Chromium refuses a module script without a
   JavaScript one; nothing ran. A classic script has no such check.
2. **`ReferenceError: queueMicrotask is not defined`.** Once loaded as a classic script, the bundle
   stopped at the first render: Preact schedules its renders with `queueMicrotask`, which Chrome
   only has since 71. `make build` checked the syntax (es-check) but not the runtime APIs, and the
   ESLint compatibility check only looked at Mirante's own calls, not at the dependencies.

What Mirante does about it:

- The webOS build (`vite.webos.config.ts`, part of `make build`) bundles the app as **one classic
  script** (`iife`) into `build/webos-dist/`, and its `index.html` loads it with
  `<script defer src="./assets/index-….js">` and links the stylesheet without `crossorigin`
  (`scripts/webos/classic-script.ts`). es-check reads it as a script, so `import`, `export`,
  `import.meta` and a top-level `await` fail the build. The web build in `dist/`, served behind the
  proxy over HTTP, stays a module.
- `src/platform/polyfills.ts` adds `queueMicrotask` and `Object.fromEntries` where the engine lacks
  them, from the first module of the bundle (`src/platform/install-polyfills.ts`).
- `make lint` and `make build` check every global API the code reaches, the bundled dependencies
  included, against the browser tables of MDN for Chrome 68 (`scripts/browser-apis/`): a new API
  Chromium 68 lacks fails the build until it is polyfilled and listed in `.browser-apis.json`.

## Debugging

```sh
ares-inspect --device tv --app com.mathmed.mirante --open
```

opens Chrome's developer tools on the app running on the TV. The console shows Mirante's errors,
tagged `[mirante]`, and the package carries the source maps of the build. A request the proxy
refuses (no CORS) shows there as a CORS error, and on the screen as **O Immich não respondeu**.

Without `--open`, `ares-inspect` prints the address of the app's inspector on the TV instead of
opening a browser. Besides opening it in Chrome, a script can talk to it with the Chrome DevTools
Protocol (CDP): the `/json/list` path of that address lists the pages of the app with their
`webSocketDebuggerUrl`, and the `Runtime.enable` and `Log.enable` commands sent over that socket
send back the console messages the page already logged, the errors that stop it included. The
first things to look at:

- a console with **nothing at all**: the script did not load; check the `<script>` tag of the
  installed `index.html` (no `type="module"`);
- a **`ReferenceError`** naming a function: an API Chromium 68 lacks; add it to
  `src/platform/polyfills.ts` and `.browser-apis.json`.

## Testing the package

```sh
make test-webos
```

builds and packages the app against a fake Immich on a local port that answers CORS like the
proxy, unpacks the `.ipk` and opens its `index.html` from `file://` in Playwright's headless
Chromium, with access to its own files as the TV's web app runtime gives. The browser is made to
look like the LG (`e2e/legacy-chromium.ts`): the scripts are served without a MIME type, so it
refuses module scripts as the TV does, and `queueMicrotask` and `Object.fromEntries` are removed
before any script runs. It checks the files of the package, its `appinfo.json` and that its
`index.html` loads no module; that the app starts with the polyfills in place, while the web build
(a module) stays blank in the same browser, as on the TV; that the albums, thumbnails and previews
load across origins without a key; that Back leaves the app from the start screen; and that an
Immich without CORS is reported as unreachable. It installs Playwright's Chromium the first time,
and is not part of `make quality` or CI. A current Chromium is still not the TV's Chromium 68: the
bundle's syntax, built-ins and global APIs are checked by `make build` against it.
