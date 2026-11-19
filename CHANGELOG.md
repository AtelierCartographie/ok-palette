# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `categorical()` — les couleurs produites changent (l'API et les options restent identiques) :
  - la chroma est bornée au maximum atteignable en sRGB pour chaque (L, H) : plus aucune couleur hors gamut, donc plus d'écrêtage par le navigateur (avant : jusqu'à 11 couleurs sur 16 hors gamut avec `vif`) ;
  - la luminosité n'est plus imposée par `i % 3` : pour chaque nouvelle couleur, le niveau (parmi 11) le plus éloigné en ΔE OK des couleurs déjà placées est retenu, pondéré par la part de chroma conservée dans le gamut ;
  - une plage de teintes de 270° ou moins est traitée comme un arc : ses deux extrémités sont utilisées en premier ;
  - ajouter une classe ne modifie toujours pas les couleurs précédentes.
- `presets` : `vif` passe à L 0,55–0,8 ; `pastel` à C 0,05–0,12 et L 0,78–0,93 ; `sepia` à H 25–85°, C 0,03–0,08 et L 0,4–0,92 (ΔE OK min à 8 classes : 0,007 → 0,05).
- `temperature` : `chaude` passe de 300–480° à 330–450° (sans violets ni magentas, jusqu'au jaune doré) ; `froide` de 120–300° à 140–300°.

### Added

- `scripts/diagnose-categorical.ts` (`pnpm diagnose:categorical`) : couleurs hors gamut et ΔE OK minimal de chaque préréglage × température, de 2 à 16 classes.

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
