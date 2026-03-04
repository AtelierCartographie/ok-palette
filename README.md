# @ateliercartographie/ok-palette

Générateur de palettes de couleurs **séquentielles, divergentes et catégorielles** pour la **dataviz** et la **cartographie**. Génère aussi des **palettes de motifs** compatibles avec [@ateliercartographie/motif.js](https://github.com/AtelierCartographie/motif.js).

Zero dependencies. Relies entirely on modern browser CSS capabilities (`oklch`, `color-mix()`) to guarantee perceptually uniform results.

**Created by:** [Thomas Ansart — Atelier de cartographie de Sciences Po](https://www.sciencespo.fr/cartographie/)  
**License:** ISC

## Installation

```bash
pnpm add @ateliercartographie/ok-palette
```

## Quick start

```ts
import {
  sequential,
  divergent,
  divergentSequential,
  categorical,
  categoricalPatterns,
  sequentialPatterns,
  resolveColor,
  resolvePalette,
  presets,
  temperature,
} from "@ateliercartographie/ok-palette";

// 5-class monochrome sequential palette
const mono = sequential({ colorStart: "steelblue" });

// 7-class two-tone sequential palette, high contrast
const biTone = sequential({
  colorStart: "#f4e285",
  colorEnd: "#1d3557",
  steps: 7,
  contrast: "high",
});

// Symmetric diverging palette (3+1+3 classes)
const div = divergent({ colorA: "#3b4cc0" });

// Asymmetric diverging palette, oklch interpolation
const divLch = divergent({
  colorA: "#d7191c",
  colorB: "#2b83ba",
  steps: [5, 2],
  contrast: "high",
  colorSpace: "oklch",
});

// Diverging palette built as two mirrored sequential palettes
const divSeq = divergentSequential({ colorA: "steelblue" });

// 8-color vivid categorical palette
const colors = categorical(8, presets.vif);

// Warm categorical palette with hue offset
const warm = categorical(6, {
  ...presets.vif,
  ...temperature.chaude,
  hueOffset: 30,
});

// Categorical patterns for motif.js
const patterns = categoricalPatterns(6);

// Sequential patterns (size progressively increases with contrast)
const seqPatterns = sequentialPatterns(5, { shape: "line", contrast: "high" });

// Resolve CSS colors to usable values
const css = resolvePalette(mono); // string[]
const webgl = resolvePalette(mono, { format: "webgl" }); // [r,g,b,a][]
```

## API

### `sequential(options)`

Generates a sequential palette (monochrome or two-tone).

| Option       | Type                          | Default      | Description                                         |
| ------------ | ----------------------------- | ------------ | --------------------------------------------------- |
| `colorStart` | `string`                      | —            | CSS start color (light tones)                       |
| `colorEnd`   | `string?`                     | `colorStart` | CSS end color (dark tones). If omitted → monochrome |
| `steps`      | `number`                      | `5`          | Number of classes (2–12)                            |
| `contrast`   | `"low" \| "normal" \| "high"` | `"normal"`   | Contrast profile                                    |

**Returns** `string[]` — CSS colors `color-mix(in oklch, …)`.

#### How it works

The start color is normalized to a light tone (chroma halved to avoid a fluorescent effect), the end color to a dark tone. The lightness range is automatically adapted to the number of classes via the contrast profile, inspired by ColorBrewer palette analysis:

- **3 classes** → ~30% lightness gap
- **9 classes** → ~70% lightness gap

Interpolation is entirely delegated to the browser via `color-mix(in oklch, …)`: no color library needed.

### `divergent(options)`

Generates a diverging (bipolar) palette around a tinted pivot.

| Option           | Type                          | Default                | Description                      |
| ---------------- | ----------------------------- | ---------------------- | -------------------------------- |
| `colorA`         | `string`                      | —                      | Left-extreme CSS color           |
| `colorB`         | `string?`                     | complement of `colorA` | Right-extreme CSS color          |
| `steps`          | `[number, number]`            | `[3, 3]`               | Classes per side `[left, right]` |
| `contrast`       | `"low" \| "normal" \| "high"` | `"normal"`             | Contrast profile                 |
| `hasCenterClass` | `boolean`                     | `true`                 | Add a neutral center class       |
| `colorSpace`     | `"oklab" \| "oklch"`          | `"oklab"`              | Ramp interpolation color space   |

**Returns** `string[]` — CSS colors.

#### How it works

Both extremes converge toward an automatically derived **tinted pivot**: the OkLab midpoint of light, highly-desaturated variants of A and B. Because A and B are opposite on the hue wheel, their components almost cancel in OkLab, producing a quasi-neutral, slightly-tinted tone — visually integrated rather than a foreign grey.

- `colorSpace: "oklab"` (default): Cartesian path — smoother, avoids hue artifacts
- `colorSpace: "oklch"`: circular path on the hue wheel — more saturated at the center

```ts
// Default symmetric palette (7 classes: 3 + pivot + 3)
divergent({ colorA: "#3b4cc0" });

// Asymmetric, high contrast, oklch interpolation
divergent({
  colorA: "#d7191c",
  colorB: "#2b83ba",
  steps: [5, 2],
  contrast: "high",
  colorSpace: "oklch",
});

// Even count without center class (6 classes)
divergent({ colorA: "steelblue", steps: [3, 3], hasCenterClass: false });
```

### `divergentSequential(options)`

Generates a diverging palette built as two mirrored `sequential()` calls — guarantees full consistency with the sequential palette.

Accepts the same options as `divergent()` **except** `colorSpace` (interpolation is always oklch, as in `sequential`).

| Option           | Type                          | Default    | Description                |
| ---------------- | ----------------------------- | ---------- | -------------------------- |
| `colorA`         | `string`                      | —          | Left-extreme color         |
| `colorB`         | `string?`                     | complement | Right-extreme color        |
| `steps`          | `[number, number]`            | `[3, 3]`   | Classes per side           |
| `contrast`       | `"low" \| "normal" \| "high"` | `"normal"` | Contrast profile           |
| `hasCenterClass` | `boolean`                     | `true`     | Add a neutral center class |

**Returns** `string[]` — CSS colors.

```ts
// Rigorously identical to two mirrored `sequential` calls
divergentSequential({ colorA: "#3b4cc0" });

// Asymmetric without center class
divergentSequential({
  colorA: "#d7191c",
  colorB: "#2b83ba",
  steps: [5, 2],
  hasCenterClass: false,
});
```

### `categorical(count, options?)`

Generates a categorical color palette.

| Option           | Type               | Default        | Description                        |
| ---------------- | ------------------ | -------------- | ---------------------------------- |
| `hueRange`       | `[number, number]` | `[0, 360]`     | Hue range in degrees               |
| `hueOffset`      | `number`           | `0`            | Hue rotation applied to all colors |
| `chromaRange`    | `[number, number]` | `[0.15, 0.25]` | Oklch chroma range                 |
| `lightnessRange` | `[number, number]` | `[0.5, 0.75]`  | Oklch lightness range, values 0–1  |

**Returns** `string[]` — CSS colors `oklch(…)`.

#### Presets

```ts
presets.vif; // Saturated, vivid colors
presets.pastel; // Soft, light colors
presets.sepia; // Warm, desaturated tones
```

#### Temperature filters

```ts
temperature.mixte; // Full hue wheel
temperature.chaude; // Reds, oranges, yellows
temperature.froide; // Greens, blues, purples
```

Combining: `categorical(8, { ...presets.vif, ...temperature.chaude })`

#### Van der Corput sequence

Hue distribution relies on the [Van der Corput sequence](https://en.wikipedia.org/wiki/Van_der_Corput_sequence) in base 2. It always fills the largest gap on the hue wheel, guaranteeing maximum distance between colors regardless of count.

Performance: 10 000 colors in ~4 ms.

### `categoricalPatterns(count, options?)`

Generates categorical pattern parameters compatible with [@ateliercartographie/motif.js](https://github.com/AtelierCartographie/motif.js).

| Option       | Type               | Default                                   | Description             |
| ------------ | ------------------ | ----------------------------------------- | ----------------------- |
| `shapes`     | `string[]`         | `["line", "circle", "plaid", "triangle"]` | Shapes to cycle through |
| `angleRange` | `[number, number]` | `[0, 180]`                                | Angle range (degrees)   |
| `scaleRange` | `[number, number]` | `[2, 8]`                                  | Scale range             |
| `size`       | `number`           | `10`                                      | Fixed size              |
| `fill`       | `string`           | `"#ffffff"`                               | Fill color              |
| `background` | `string`           | `"transparent"`                           | Background color        |
| `patchSize`  | `boolean`          | `true`                                    | Enable patchSize        |
| `vdcOffset`  | `number`           | `0`                                       | Van der Corput offset   |

**Returns** `PatternParams[]`

### `sequentialPatterns(count, options?)`

Generates sequential pattern parameters compatible with [@ateliercartographie/motif.js](https://github.com/AtelierCartographie/motif.js).

Pattern **size** increases monotonically across classes, analogous to the lightness range in sequential color palettes. The size range is adapted to both the class count and the contrast profile.

The shape is fixed to preserve the perception of order.

| Option       | Type                          | Default         | Description               |
| ------------ | ----------------------------- | --------------- | ------------------------- |
| `shape`      | `string`                      | `"line"`        | Pattern shape             |
| `sizeRange`  | `[number, number]`            | `[4, 14]`       | Size range [small, large] |
| `angle`      | `number`                      | `45`            | Fixed angle (degrees)     |
| `scale`      | `number`                      | `4`             | Fixed scale               |
| `contrast`   | `"low" \| "normal" \| "high"` | `"normal"`      | Contrast profile          |
| `fill`       | `string`                      | `"#ffffff"`     | Fill color                |
| `background` | `string`                      | `"transparent"` | Background color          |
| `patchSize`  | `boolean`                     | `true`          | Enable patchSize          |

**Returns** `PatternParams[]`

### `resolveColor(color, options?)`

Resolves a complex CSS color (`color-mix(…)`, `oklch(from …)`, etc.) to a usable value.

- `{ format: "css" }` (default) → `string` as computed by the browser
- `{ format: "webgl" }` → `[r, g, b, a]` (0–255)

### `resolvePalette(colors, options?)`

Applies `resolveColor` to an entire array of colors.

## Why this approach?

### Problem 1 — Color space

The choice of interpolation space dramatically changes the result. Using **oklch** guarantees perceptually uniform steps across each component (lightness, chroma, hue). As of 2025, oklch is supported by all modern browsers.

### Problem 2 — Lightness range

A sequential palette only works if the lightness gap between the first and last color is sufficient and adapted to the number of classes. This library automatically normalizes input colors to guarantee a readable result.

### Solution

- **Universal**: normalizes any CSS color before generating the palette
- **Modern**: zero dependencies, relies on native `oklch` and `color-mix()`
- **Performant**: the Van der Corput sequence generates categorical palettes in constant time, unlike iterative approaches like I Want Hue

## Development

```bash
# Start the demo page
pnpm dev

# Build the library
pnpm build
```

## License

ISC — Atelier de cartographie de Sciences Po

## Resources

- [Chroma.js](https://gka.github.io/chroma.js) — Documentation
- [Chroma.js Color Palette Helper](https://gka.github.io/palettes)
- [MDN — `color-mix()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix)
- [ColorBrewer](https://colorbrewer2.org/)
- [Mastering Multi-hued Color Scales](https://www.vis4.net/blog/mastering-multi-hued-color-scales/) — Gregor Aisch
- [Van der Corput sequence](https://en.wikipedia.org/wiki/Van_der_Corput_sequence)
- [@ateliercartographie/motif.js](https://github.com/AtelierCartographie/motif.js)
