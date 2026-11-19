# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Gamut** — `sequential()`, `divergent()` et `divergentSequential()` renvoient désormais par défaut des `oklch(L C H)` calculés en JS, dont la chroma est bornée classe par classe au maximum du gamut sRGB (`gamut: "srgb"`). Auparavant, ces fonctions renvoyaient du CSS (`color-mix()`, couleurs relatives) dont une partie des classes sortait du gamut sRGB et était écrêtée par le navigateur (52 % des classes séquentielles et 22 % des classes divergentes du jeu d'essai). Les classes qui étaient dans le gamut gardent le même rendu ; les autres perdent un peu de chroma, à luminosité et teinte égales. `gamut: "none"` rétablit la sortie CSS d'avant.
- `categorical()` — les couleurs produites changent (l'API et les options restent identiques) :
  - la chroma est bornée au maximum atteignable en sRGB pour chaque (L, H) : plus aucune couleur hors gamut, donc plus d'écrêtage par le navigateur (avant : jusqu'à 11 couleurs sur 16 hors gamut avec `vif`) ;
  - la luminosité n'est plus imposée par `i % 3` : pour chaque nouvelle couleur, le niveau (parmi 11) le plus éloigné en ΔE OK des couleurs déjà placées est retenu, pondéré par la part de chroma conservée dans le gamut ;
  - une plage de teintes de 270° ou moins est traitée comme un arc : ses deux extrémités sont utilisées en premier ;
  - ajouter une classe ne modifie toujours pas les couleurs précédentes.
- `presets` : `vif` passe à L 0,55–0,8 ; `pastel` à C 0,05–0,12 et L 0,78–0,93 ; `sepia` à H 25–85°, C 0,03–0,08 et L 0,4–0,92 (ΔE OK min à 8 classes : 0,007 → 0,05).
- `temperature` : `chaude` passe de 300–480° à 330–450° (sans violets ni magentas, jusqu'au jaune doré) ; `froide` de 120–300° à 140–300°.

### Added

- Option `gamut: "srgb" | "p3" | "none"` (défaut `"srgb"`) sur `sequential()`, `divergent()`, `divergentSequential()`, `categorical()` et, via `colorize`, `categoricalPatterns()`. `"p3"` borne au gamut Display P3 ; `"none"` garde le comportement CSS pur. Type `Gamut` exporté.
- Lecture des couleurs CSS en JS (hex, noms, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, `color()`), avec repli sur le navigateur pour les autres syntaxes et sur la sortie CSS pure si la couleur est illisible.
- `scripts/diagnose-ramps.ts` (`pnpm diagnose:ramps`) : classes hors gamut, écart entre couleur calculée et affichée et classes voisines confondues, pour les palettes séquentielles et divergentes, en `none` / `srgb` / `p3`, sur écran sRGB et P3. `pnpm diagnose:categorical --gamut p3` mesure les palettes catégorielles en P3.
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
