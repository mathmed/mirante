# Mirante on a Samsung Tizen TV

Mirante can be installed on a Samsung TV as a Tizen web app (`.wgt`), so it opens from the TV's
apps instead of its browser. This page explains how to build the package, why and how it must be
signed with your own certificates, and how to install, open and debug it with the Tizen CLI.

> Nothing here has been tried on a real TV yet. The package is checked by `make test-tizen` in a
> headless Chromium (see [Testing the package](#testing-the-package)), not on a Tizen device. The
> target is a Samsung QN65Q60B (2022, Tizen 6.5, Chromium ~85).

## How the packaged app reaches Immich

The app installed on the TV loads from the TV's file system (`file://`), not from the reverse proxy
in front of Immich, so it is never on the same origin as Immich. The rules are the ones of the
[webOS app](webos.md#how-the-packaged-app-reaches-immich):

- `immichUrl` must be the **full address of the proxy**, such as `http://192.168.0.10:8085`.
  Packaging refuses a relative address (empty or a path).
- The proxy must answer **CORS** for the app: `Access-Control-Allow-Origin: *`, a `204` to the
  preflight `OPTIONS`, the methods `GET`, `HEAD`, `POST` and `OPTIONS`, and the header
  `Content-Type` (`Access-Control-Allow-Headers: Content-Type`), which the random draw of the
  library sends with its JSON body. [docs/proxy.md](proxy.md) lists the routes the proxy lets
  through, with a Caddyfile.
- The proxy adds the **API key** to the requests it sends to Immich. The package never carries a
  key: packaging refuses a configuration with `apiKey`, because anyone with the `.wgt` could read it.
- The photos load as plain images (`<img src>`) from the same address.

On top of that, a Tizen widget only reaches the origins its `config.xml` allows, and only with the
`internet` privilege: `tizen/config.xml` declares `<access origin="*" subdomains="true"/>` and
`http://tizen.org/privilege/internet`, and packaging refuses a `config.xml` without them. It also
declares `http://tizen.org/privilege/tv.inputdevice`, for the Info key (see below).

## Building the package

1. Write the configuration of the package. Either copy the example and fill it in:

   ```sh
   cp tizen/config.example.json tizen/config.json   # gitignored: never commit it
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
   make package-tizen
   ```

   It runs `make build` (the bundle checked against ES2018), lays out `build/tizen/widget/` with the
   build, `config.xml`, `config.json` and the icon, and zips that folder into
   `build/tizen/Mirante.wgt`, then lists its files. The zip is written by `scripts/tizen/zip.ts`, so
   packaging needs no Tizen tool and gives the same bytes for the same build.

**The `.wgt` is not signed**, and a TV only installs signed packages: sign the widget folder with
your certificates as described below. The unsigned `.wgt` holds exactly the files of
`build/tizen/widget/`, the folder the Tizen CLI signs.

What goes into the package:

| File                    | Where it comes from                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `index.html`, `assets/` | `dist/`, byte for byte                                                                  |
| `config.xml`            | `tizen/config.xml`, plus the `version` of `package.json`                                |
| `config.json`           | `MIRANTE_IMMICH_URL`, or `tizen/config.json`                                            |
| `icon.png`              | 117x117, the mark of the logo drawn by `scripts/packaging/icon.ts` (no committed image) |

`tizen/config.xml` declares the widget:

- the application id `MirantTV01.Mirante`, in Tizen's format: a package id of 10 letters and
  digits (`MirantTV01`), a dot and the name. Packaging checks it;
- `required_version="6.5"` and the `tv-samsung` profile;
- `index.html` as its content and `icon.png` as its icon;
- `<access origin="*" subdomains="true"/>` and two privileges: `internet`, to reach the proxy, and
  `tv.inputdevice`, for the Info key of the remote control. A package signed before needs signing
  again with them.

It has no `version`: the version is always the one of `package.json`, which Tizen wants as three
numbers up to `255.255.65535`.

The configuration is inside the package: to change the address, package, sign and install again.
Packaging stops with a message in Portuguese when the configuration is missing, is not JSON, has
a relative `immichUrl` or has an `apiKey`, or when `config.xml` misses a required field.

### The remote control

Arrows (37–40), Enter/OK (13) and Back (10009) reach every Tizen app without
`tizen.tvinputdevice.registerKey`, which Info and the color, media and number keys need. The app
registers Info (457) at startup, with the `tv.inputdevice` privilege, to open the settings over the
viewer; if the TV refuses it, the error goes to the console and Down opens the same settings. Back
arrives as a `keydown` with code
10009; the app does not also listen to `tizenhwkey`, the hardware Back of Tizen phones and
watches, which would act twice on one press. Back returns one screen at a time, and on the start
screen (or the connecting and error screens before it) it leaves the app with
`tizen.application.getCurrentApplication().exit()`.

## What you need to sign and install

- **Tizen Studio** (or its command-line edition) with the **Samsung TV Extension** and the
  **Samsung Certificate Extension**, installed from its Package Manager. It brings the Certificate
  Manager, the `tizen` CLI (`tizen-studio/tools/ide/bin/`) and `sdb` (`tizen-studio/tools/`); add
  both folders to your `PATH`.
- A **Samsung account**: the Certificate Manager signs in with it to issue Samsung certificates.
- The TV on the same network as the computer, in **Developer Mode** (below).

None of this is needed to build or test the package, and none of it belongs in the repository:
never commit a certificate, its password, a profile, a DUID or the TV's address.

### Turning on Developer Mode on the TV

1. On the TV, open **Apps**.
2. Type `1`, `2`, `3`, `4`, `5` on the remote control (the on-screen keypad on remotes without
   digits). The Developer Mode dialog opens.
3. Turn **Developer mode** on and type the **IP address of your computer** (the one that runs `sdb`).
4. Restart the TV (hold the power button until it turns off and on again).

The TV shows **Developer Mode** at the top of the **Apps** screen while it is on. Find the TV's IP
address in **Settings → General → Network → Network Status → IP Settings**.

### Connecting to the TV

```sh
sdb connect <tv-ip>       # port 26101
sdb devices               # lists the TV: <tv-ip>:26101, device, and its name, the target below
```

`sdb devices` prints the serial and the name of the TV; the `tizen` commands take that name as
`-t <target>`.

## Signing: the certificate profile

A Samsung TV installs a `.wgt` only when it carries two signatures, from a **certificate profile**:

- an **author certificate**, which identifies you as the developer of the app. Every later version
  must be signed with the same author certificate, or the TV refuses the update (remove the app
  first);
- a **Samsung distributor certificate**, which lists the **DUIDs** (device unique ids) of the TVs
  allowed to install the app. A TV whose DUID is not in it refuses the package.

### The DUID of the TV

The distributor certificate must include the DUID of your TV. With the TV in Developer Mode and
connected (`sdb connect <tv-ip>`), the Certificate Manager reads it by itself and offers it when it
creates the distributor certificate. Otherwise, look for it in what the connected TV reports with
`sdb capability`, and add it to the certificate by hand.
The DUID changes with the TV (a new TV, or a main board replaced): then create a new distributor
certificate.

### Creating the profile (once, by hand)

This is a manual step of the owner: it needs a Samsung account and creates private keys that never
leave your computer.

1. Open Tizen Studio's **Certificate Manager** (**Tools → Certificate Manager**).
2. Add a profile (**+**), choose **Samsung**, then **TV**, and name it (for example `mirante`).
3. **Author certificate**: create a new one, with your name and a password. Keep the password and a
   backup of the certificate: you need the same one for every update.
4. Sign in with your **Samsung account** when asked.
5. **Distributor certificate**: keep the **Public** privilege level, and check that the DUID of the
   TV is in the list (add it by hand if the TV was not connected).
6. Finish. The Certificate Manager saves the profile; `tizen security-profiles list` shows it.

**The certificates expire.** The Certificate Manager shows the validity of each one. When the
distributor certificate expires, or the TV's DUID changes, create a new distributor certificate in
the same profile (keep the author certificate), sign the package again and reinstall it. If the
author certificate itself expires or is lost, a new one cannot update the installed app: remove it
from the TV and install the newly signed one.

## Signing, installing and opening the app

Sign the widget folder that `make package-tizen` laid out, into a folder of its own:

```sh
tizen package -t wgt -s <profile> -o build/tizen/signed -- build/tizen/widget
```

`build/tizen/signed/Mirante.wgt` now carries `author-signature.xml` and `signature1.xml`. Install it
on the TV and open it:

```sh
tizen install -n Mirante.wgt -t <target> -- build/tizen/signed
tizen run -p MirantTV01.Mirante -t <target>
```

The app also appears in the TV's **Apps** as **Mirante**. To install a new version, package, sign
and install again: it replaces the installed one when the author certificate is the same.

## Debugging

The app writes its errors to the console, tagged `[mirante]`, and the package carries the source
maps of the build. Tizen Studio can open Chrome's developer tools on the app running on the TV
(**Debug As → Tizen Web Application** on a project made of `build/tizen/widget/`, signed with the
same profile). A request the proxy refuses (no CORS) shows there as a CORS error, and on the screen
as **O Immich não respondeu**.

## Testing the package

```sh
make test-tizen
```

builds and packages the app against a fake Immich on a local port that answers CORS like the
proxy, unzips the `.wgt` and opens its `index.html` from `file://` in Playwright's headless
Chromium, with access to its own files and a `tizen` global that counts the calls to leave. It
checks the files of the package, its `config.xml` and `config.json`, that the albums, thumbnails and
previews load across origins without a key, that Back leaves the app from the start screen, and that
an Immich without CORS is reported as unreachable. It installs Playwright's Chromium the first time,
and is not part of `make quality` or CI. It does not sign the package nor exercise Tizen's web
runtime: a current Chromium is not the TV's Chromium 85, and `make build` checks the bundle's syntax
and built-ins instead.
