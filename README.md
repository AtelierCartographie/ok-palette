# @ateliercartographie/ok-palette

Générateur de palettes de couleurs séquentielles et catégorielles pour la **dataviz** et la **cartographie**.

Zéro dépendance. Repose entièrement sur les capacités CSS modernes des navigateurs (`oklch`, `color-mix()`) pour garantir des résultats perceptuellement uniformes.

## Installation

```bash
pnpm add @ateliercartographie/ok-palette
```

## Utilisation rapide

```ts
import {
  sequential,
  categorical,
  categoricalPatterns,
  sequentialPatterns,
  resolveColor,
  resolvePalette,
  presets,
  temperature,
} from "@ateliercartographie/ok-palette";

// Palette séquentielle monochrome (5 classes)
const mono = sequential({ colorStart: "steelblue" });

// Palette séquentielle bi-tons (7 classes, contraste élevé)
const biTone = sequential({
  colorStart: "#f4e285",
  colorEnd: "#1d3557",
  steps: 7,
  contrast: "high",
});

// Palette catégorielle (8 couleurs vives)
const colors = categorical(8, presets.vif);

// Palette catégorielle chaude
const warm = categorical(6, { ...presets.vif, ...temperature.chaude });

// Motifs catégoriels pour motif.js
const patterns = categoricalPatterns(6);

// Motifs séquentiels (taille progressive selon le contraste)
const seqPatterns = sequentialPatterns(5, { shape: "line", contrast: "high" });

// Résolution des couleurs CSS vers des valeurs exploitables
const css = resolvePalette(mono); // string[]
const webgl = resolvePalette(mono, { format: "webgl" }); // [r,g,b,a][]
```

## API

### `sequential(options)`

Génère une palette séquentielle (monochrome ou bi-tons).

| Option       | Type                          | Défaut       | Description                                              |
| ------------ | ----------------------------- | ------------ | -------------------------------------------------------- |
| `colorStart` | `string`                      | —            | Couleur CSS de départ (tons clairs)                      |
| `colorEnd`   | `string?`                     | `colorStart` | Couleur CSS de fin (tons sombres). Si omise → monochrome |
| `steps`      | `number`                      | `5`          | Nombre de classes (2–12)                                 |
| `contrast`   | `"low" \| "normal" \| "high"` | `"normal"`   | Profil de contraste                                      |

**Retourne** `string[]` — Couleurs CSS `color-mix(in oklch, …)`.

#### Comment ça marche

La couleur de départ est normalisée en ton clair (chroma réduite de moitié pour éviter l'effet fluo), la couleur de fin en ton sombre. L'écart de luminosité est adapté automatiquement au nombre de classes grâce au profil de contraste, inspiré de l'analyse des palettes ColorBrewer :

- **3 classes** → écart de ~30 %
- **9 classes** → écart de ~70 %

L'interpolation est entièrement déléguée au navigateur via `color-mix(in oklch, …)` : aucune librairie de couleur n'est nécessaire.

### `categorical(count, options?)`

Génère une palette catégorielle de couleurs.

| Option           | Type               | Défaut         | Description                     |
| ---------------- | ------------------ | -------------- | ------------------------------- |
| `hueRange`       | `[number, number]` | `[0, 360]`     | Plage de teinte (degrés)        |
| `chromaRange`    | `[number, number]` | `[0.15, 0.25]` | Plage de chroma oklch           |
| `lightnessRange` | `[number, number]` | `[0.5, 0.75]`  | Plage de luminosité oklch (0–1) |

**Retourne** `string[]` — Couleurs CSS `oklch(…)`.

#### Presets

```ts
presets.vif; // Couleurs saturées et lumineuses
presets.pastel; // Couleurs douces et claires
presets.sepia; // Tons chauds désaturés
```

#### Filtres de température

```ts
temperature.mixte; // Tout le cercle chromatique
temperature.chaude; // Rouges, oranges, jaunes
temperature.froide; // Verts, bleus, violets
```

Combinaison : `categorical(8, { ...presets.vif, ...temperature.chaude })`

#### Séquence de Van der Corput

La répartition des teintes repose sur la [séquence de Van der Corput](https://fr.wikipedia.org/wiki/Suite_de_van_der_Corput) en base 2. Elle comble systématiquement le plus grand trou disponible dans le cercle chromatique, garantissant une distance maximale entre les couleurs, quel que soit le nombre demandé.

Performance : 10 000 couleurs en ~4 ms.

### `categoricalPatterns(count, options?)`

Génère des paramètres de motifs catégoriels compatible avec [@ateliercartographie/motif.js](https://github.com/AtelierCartographie/motif.js).

| Option       | Type               | Défaut                                    | Description             |
| ------------ | ------------------ | ----------------------------------------- | ----------------------- |
| `shapes`     | `string[]`         | `["line", "circle", "plaid", "triangle"]` | Formes à cycler         |
| `angleRange` | `[number, number]` | `[0, 180]`                                | Plage d'angles (degrés) |
| `scaleRange` | `[number, number]` | `[2, 8]`                                  | Plage d'échelles        |
| `size`       | `number`           | `10`                                      | Taille fixe             |
| `fill`       | `string`           | `"#ffffff"`                               | Couleur de remplissage  |
| `background` | `string`           | `"transparent"`                           | Couleur de fond         |
| `patchSize`  | `boolean`          | `true`                                    | Activer patchSize       |
| `vdcOffset`  | `number`           | `0`                                       | Décalage Van der Corput |

**Retourne** `PatternParams[]`

### `sequentialPatterns(count, options?)`

Génère des paramètres de motifs séquentiels compatibles avec [@ateliercartographie/motif.js](https://github.com/AtelierCartographie/motif.js).

La **taille** du motif progresse de façon monotone entre les classes, analogue à l'écart de luminosité dans les palettes de couleurs séquentielles. L'écart de taille est adapté au nombre de classes et au profil de contraste.

La forme reste fixe pour préserver la perception d'ordre.

| Option       | Type                          | Défaut          | Description                     |
| ------------ | ----------------------------- | --------------- | ------------------------------- |
| `shape`      | `string`                      | `"line"`        | Forme unique du motif           |
| `sizeRange`  | `[number, number]`            | `[4, 14]`       | Plage de tailles [petit, grand] |
| `angle`      | `number`                      | `45`            | Angle fixe (degrés)             |
| `scale`      | `number`                      | `4`             | Échelle fixe                    |
| `contrast`   | `"low" \| "normal" \| "high"` | `"normal"`      | Profil de contraste             |
| `fill`       | `string`                      | `"#ffffff"`     | Couleur de remplissage          |
| `background` | `string`                      | `"transparent"` | Couleur de fond                 |
| `patchSize`  | `boolean`                     | `true`          | Activer patchSize               |

**Retourne** `PatternParams[]`

### `resolveColor(color, options?)`

Résout une couleur CSS complexe (`color-mix(…)`, `oklch(from …)`, etc.) vers une valeur exploitable.

- `{ format: "css" }` (défaut) → `string` calculée par le navigateur
- `{ format: "webgl" }` → `[r, g, b, a]` (0–255)

### `resolvePalette(colors, options?)`

Applique `resolveColor` à un tableau entier de couleurs.

## Pourquoi cette approche ?

### Problème n°1 — L'espace colorimétrique

Le choix de l'espace d'interpolation change radicalement le résultat. Utiliser **oklch** garantit des sauts perceptuellement réguliers sur chaque composante (luminosité, chroma, teinte). En 2025, oklch est supporté par tous les navigateurs modernes.

### Problème n°2 — L'écart de luminosité

Une palette séquentielle ne fonctionne que si l'écart de luminosité entre la première et la dernière couleur est suffisant et adapté au nombre de classes. Cette librairie normalise automatiquement les couleurs d'entrée pour garantir un résultat lisible.

### Solution

- **Universelle** : normalise n'importe quelle couleur CSS avant de générer la palette
- **Moderne** : zéro dépendance, repose sur `oklch` et `color-mix()` natifs
- **Performante** : la séquence de Van der Corput génère des palettes catégorielles en temps constant, contrairement aux approches itératives type I Want Hue

## Développement

```bash
# Lancer la page de démo
pnpm dev

# Build de la librairie
pnpm build
```

## Licence

ISC — Atelier de cartographie de Sciences Po

## Ressources

- [Chroma.js](https://gka.github.io/chroma.js) — Documentation
- [Chroma.js Color Palette Helper](https://gka.github.io/palettes)
- [MDN — `color-mix()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix)
- [ColorBrewer](https://colorbrewer2.org/)
- [Mastering Multi-hued Color Scales](https://www.vis4.net/blog/mastering-multi-hued-color-scales/) — Gregor Aisch
- [Séquence de Van der Corput](https://fr.wikipedia.org/wiki/Suite_de_van_der_Corput)
- [@ateliercartographie/motif.js](https://github.com/AtelierCartographie/motif.js)
