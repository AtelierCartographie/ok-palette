# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

No changes yet.

## [0.1.0] - 2026-03-04

### Added

- Initial release
- `sequential()` — palette séquentielle monochrome ou bi-tons via `color-mix(in oklch, …)`
- `divergent()` — palette bi-polaire avec pivot teinté automatique et espace d'interpolation configurable (`oklab` | `oklch`)
- `divergentSequential()` — palette divergente construite comme deux `sequential()` miroir
- `categorical()` — palette catégorielle via séquence de Van der Corput, avec `hueOffset`, `hueRange`, `chromaRange`, `lightnessRange`
- `categoricalPatterns()` — paramètres de motifs catégoriels pour motif.js
- `sequentialPatterns()` — paramètres de motifs séquentiels pour motif.js
- `resolveColor()` / `resolvePalette()` — résolution CSS → chaîne ou tuple WebGL via OffscreenCanvas
- Presets (`vif`, `pastel`, `sepia`) et filtres de température (`mixte`, `chaude`, `froide`)
- TypeScript : types complets exportés
