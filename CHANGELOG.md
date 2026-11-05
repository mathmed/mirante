# Changelog

All notable changes to Mirante are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Mirante follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **The project skeleton.** A start screen reads `config.json` next to the app, connects to the Immich
  server it names and shows the server's address and Immich version, or explains in Portuguese what
  is wrong (no configuration, an invalid field, a server that does not answer, a rejected key) with a
  focused button to try again.
- **The quality pipeline**: strict ESLint, Stylelint and tsc, 100% coverage, architecture contracts,
  dead code and vulnerability checks, the suppression ratchet, mutation testing of the core, the
  build checked against ES2018 for the TVs, the Quality Report and the risk label.
