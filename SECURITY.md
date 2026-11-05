# Security policy

Mirante reads a private photo library with an API key: we take reports seriously and thank everyone
who makes one.

## Supported versions

Mirante is young: security fixes go into the latest version on `main` only. Update to it before you
report.

| Version      | Supported |
| ------------ | --------- |
| latest `0.x` | yes       |
| older        | no        |

## Reporting a vulnerability

**Do not open a public issue.** Report it privately through GitHub:
[_Security → Report a vulnerability_](https://github.com/mathmed/mirante/security/advisories/new)
on this repository. If that page is not available, open an issue that only asks for a private
contact, with no detail of the problem.

Please include what you found, the steps to reproduce it (the versions of Mirante and Immich, the TV
or browser, your `config.json` without its key) and what an attacker could do with it. Never send a
real API key or private photos.

This is a volunteer project: expect an answer within a week, a fix as soon as one is ready, and
credit in the changelog if you want it. Please give us a reasonable time to ship the fix before you
disclose the problem.

## What counts

- The API key ending up anywhere but the `config.json` you wrote and the `x-api-key` header of the
  requests to your Immich server: a log, an error message, a URL, the repository, a third party.
- Any request Mirante makes to Immich that changes something (Mirante only reads), or any network
  call other than to the Immich server you configure and to its own files.
- Code execution through a crafted `config.json`, server response, album name or photo metadata.

## What does not count

- Someone with access to the TV or to where `config.json` is served reading the key: the file holds
  it in plain text by design, which is why the key must be read only (see below).
- Problems of Immich itself or of the TVs' browsers: report those upstream (we will help if Mirante
  makes them worse).

## Recommended setup

Give Mirante its own Immich API key, created only for it, with read permissions only, and revoke it
in Immich if a TV is lost or the file leaks. Serve Mirante and `config.json` only on your own network
(or Tailscale), never on the public internet.
