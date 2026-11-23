# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`baseColor`** — option de `categorical()` (et, via `colorize`, de `categoricalPatterns()`) : la palette commence par cette couleur CSS (hex, `oklch()`…, chroma bornée au `gamut`, luminosité ramenée dans la plage imprimable en CMJN) et les couleurs suivantes gardent un poids visuel comparable. La plage de teintes commence à sa teinte (`hueOffset` est ignoré ; un arc garde son amplitude et pivote pour commencer à cette teinte) ; `lightnessRange` et `chromaRange` sont recentrées pour que la couleur tombe sur le niveau de la première couleur (80 % de la luminosité, 20 % de la chroma), avec des largeurs de 0,2 en luminosité et 45 % de la chroma de la couleur (au moins 0,02), ou celles des plages passées en option. Ajouter une classe ne modifie toujours pas les couleurs précédentes.
- Tests (`pnpm test`, `node:test`, sans dépendance) : `categorical()` et `baseColor`.

### Changed

- `categorical()` : quand elle vient de `baseColor`, la première couleur est écrite plus finement (luminosité à deux décimales en pourcentage, chroma à quatre : `oklch(61.22% 0.2082 22.24)`), pour qu’une couleur hex se retrouve à l’identique. Sans `baseColor`, la sortie est identique à la 0.3.0 (160 configurations comparées).

## [0.3.0] - 2026-11-20

### Added

- **Gamuts d'impression CMJN** — `gamut: "cmyk-coated"` (offset, papier couché) et `gamut: "cmyk-uncoated"` (offset, papier non couché) sur `sequential()`, `divergent()`, `divergentSequential()`, `categorical()` et, via `colorize`, `categoricalPatterns()`. Chaque gamut est l'intersection des deux générations de normes ISO 12647-2 (couché : FOGRA39 et FOGRA51 ; non couché : FOGRA29 et FOGRA52), pour que la palette s'imprime quel que soit le profil de l'imprimeur. La chroma de chaque classe est bornée à ce qui est à la fois affichable en sRGB et imprimable ; la luminosité reste au-dessus du noir imprimable, assez haut pour que la classe la plus sombre garde sa teinte (OKLab L ≥ 0,34 en couché, ≥ 0,50 en non couché), ce qui remonte l'extrémité sombre des rampes séquentielles et divergentes et borne `lightnessRange` des palettes catégorielles ; dans les rampes, la perte de chroma près du noir est étalée sur les classes sombres (`smoothDarkChroma`) pour éviter une dernière classe grisée en rupture avec les autres. Sur le jeu d'essai (1 959 classes), les classes qui ne s'impriment pas comme elles s'affichent passent de 38–54 % (couché) et 54–69 % (non couché) en `"srgb"` à 0, contrôlé avec chacun des quatre profils. Types `CmykGamut` et `Gamut` étendus.
- Tables de gamut CMJN précalculées (`src/cmyk-gamuts.data.ts`, ≈ 1,7 Ko gzip par profil) par `scripts/build-cmyk-gamuts.ts` (`pnpm build:cmyk-gamuts`) à partir des profils ICC (Adobe pour FOGRA39/29, ECI via le registre de l'ICC pour FOGRA51/52, non versionnés), avec [jsColorEngine](https://github.com/glennwilton/jsColorEngine) en dépendance de développement uniquement : la bibliothèque reste sans dépendance.
- `scripts/build-cmyk-luts.ts` (`pnpm build:cmyk-luts`) : tables sRGB → CMJN (grille 33³, colorimétrie relative sans BPC) pour l'export des valeurs CMJN du générateur web ; hors bibliothèque.
- `scripts/diagnose-cmyk.ts` (`pnpm diagnose:cmyk`) : précision des tables, classes non imprimables et confondues à l'impression en `"srgb"` et en CMJN, écart à l'export selon l'intention de rendu (relative, relative + compensation du point noir, perceptive).

### Changed

- `formatOklch` (interne) passe de `src/oklab.ts` à `src/gamut.ts`. Les palettes `"srgb"`, `"p3"` et `"none"` sont inchangées (2 674 palettes comparées à la 0.2.0).

## [0.2.0] - 2026-11-20

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
