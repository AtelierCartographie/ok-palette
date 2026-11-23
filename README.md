# @ateliercartographie/ok-palette

Color palette generator for **sequential, diverging, and categorical** schemes for **data visualization** and **cartography**. Also generates **pattern palettes** compatible with [@ateliercartographie/motif.js](https://github.com/AtelierCartographie/motif.js).

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

// 5-class monochrome sequential palette (colors kept inside sRGB by default)
const mono = sequential({ colorStart: "steelblue" });

// Same palette for Display P3 screens
const monoP3 = sequential({ colorStart: "steelblue", gamut: "p3" });

// Same palette for offset printing on coated paper (CMYK)
const monoPrint = sequential({ colorStart: "steelblue", gamut: "cmyk-coated" });

// 7-class two-tone sequential palette, high contrast
const biTone = sequential({
  colorStart: "#f4e285",
  colorEnd: "#1d3557",
  steps: 7,
  contrast: "high",
});

// Symmetric diverging palette (3+3 classes)
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

// Categorical palette starting with a given color
const brand = categorical(6, { baseColor: "#e63946" });

// Categorical patterns for motif.js
const patterns = categoricalPatterns(6);

// Sequential patterns (size progressively increases with contrast)
const seqPatterns = sequentialPatterns(5, { shape: "line", contrast: "high" });

// Resolve CSS colors to usable values
const css = resolvePalette(mono); // string[]
const webgl = resolvePalette(mono, { format: "webgl" }); // [r,g,b,a][]
```

## Gamut

Every palette function takes a `gamut` option: `"srgb"` (default), `"p3"`, `"cmyk-coated"`, `"cmyk-uncoated"` or `"none"`.

| `gamut`  | Output                     | Guarantee                                                                 |
| -------- | -------------------------- | ------------------------------------------------------------------------- |
| `"srgb"` | `oklch(L C H)` computed in JS | every color fits sRGB: displayed as computed on **every** screen        |
| `"p3"`   | `oklch(L C H)` computed in JS | every color fits Display P3: more saturated on P3 screens (recent Mac, iPhone, most recent laptops); sRGB screens clip what exceeds sRGB |
| `"cmyk-coated"` | `oklch(L C H)` computed in JS | every color fits sRGB **and** prints as displayed in CMYK offset on coated paper — see [Print (CMYK)](#print-cmyk) |
| `"cmyk-uncoated"` | `oklch(L C H)` computed in JS | same, on uncoated paper |
| `"none"` | pure CSS (`color-mix()`, relative colors) for `sequential` and `divergent*`; no chroma cap for `categorical` | none: the browser clips out-of-gamut colors |

**Why it matters.** A requested color can fall outside what the screen can show — a light, still saturated blue at 92 % lightness, a pure green made darker… The browser then clips each RGB channel, so the lightness and hue actually displayed are no longer those of the palette, and two classes can drift toward each other. On a Display P3 screen the problem is smaller (the gamut is wider), which is why it can go unnoticed while designing on a recent Mac.

**How.** CSS cannot compute the maximum chroma of a given lightness and hue, so with `"srgb"` and `"p3"` the colors are computed in JS: the input colors are read as OKLCH, the palette is interpolated exactly as the CSS version would be, then the chroma of **each class** is capped to the maximum of the target gamut for its lightness and hue. Lightness and hue are kept, so the lightness ramp of a sequential palette is untouched.

**Why sRGB by default.** It is the only gamut every screen and projector shares: a palette made for sRGB looks the same everywhere, and its classes stay distinct on every screen. Choose `"p3"` for screen-only output aimed at P3 displays, `"cmyk-coated"` / `"cmyk-uncoated"` for a map that ends up printed.

### Print (CMYK)

Offset printing reproduces fewer colors than a screen: about half of the sRGB volume on coated paper, under a third on uncoated paper (violets, greens and bright blues lose the most). Measured on this repository's test set, **38 to 54 %** of the classes of sRGB palettes do not print as displayed on coated paper (**54 to 69 %** on uncoated paper), some by ΔE00 > 10, and dark sequential classes merge.

With `gamut: "cmyk-coated"` or `"cmyk-uncoated"`, each palette is computed for both the screen and the press:

- **Chroma** of each class is capped to what is both displayable in sRGB and printable (CMYK prints some cyans and yellows that sRGB cannot show, so the intersection is used). Lightness and hue are kept, as with `"srgb"`.
- **Lightness** is kept above the deepest printable black, and high enough for the darkest class to keep its hue: OKLab L ≥ 0.34 on coated paper, ≥ 0.50 on uncoated paper. The printing gamut narrows to a point toward black: just above it, colors would all print as nearly the same grey. Each floor is the higher of the printable black + 0.04 and the lowest lightness where the median printable chroma reaches 0.06. Sequential and divergent ramps are spread over this shorter range (their dark end is raised), and `categorical`'s `lightnessRange` is clipped to it. On uncoated paper, sequential palettes are therefore noticeably less contrasted: prefer fewer classes.
- **Dark end of ramps.** Even above that floor, the darkest classes of a ramp hold much less chroma than the mid tones. Capped class by class, the last class would lose most of its chroma at once and break away from the ramp (it reads as grey, out of the family). In sequential and divergent palettes, that loss is spread over the darkest classes: the share of chroma a class keeps may only recover by 100 % of the ramp length away from the dark end, so the ramp desaturates progressively toward it. The light end is untouched.
- The output is still CSS `oklch()`, displayed as computed on every screen.

**Which printing condition.** Printers work either with the ISO 12647-2:2004 conditions (FOGRA39 / *ISO Coated v2*, FOGRA29 / *ISO Uncoated*, still the most requested) or with their 2013 successors (FOGRA51 / *PSO Coated v3*, FOGRA52 / *PSO Uncoated v3*). Their gamuts are close but not identical: a palette made for FOGRA29 alone has 6 to 9 % of its classes out of gamut in FOGRA52. Each ok-palette gamut is therefore the **intersection of both generations**, so the palette prints whichever profile the printer uses, at a negligible cost in chroma:

| `gamut` | Paper | Printable with |
| --- | --- | --- |
| `"cmyk-coated"` | coated (premium, glossy or matte) | FOGRA39 (ISO Coated v2) and FOGRA51 (PSO Coated v3) |
| `"cmyk-uncoated"` | uncoated (offset, wood-free) | FOGRA29 (ISO Uncoated) and FOGRA52 (PSO Uncoated v3) |

Result on the same test set (1,959 classes), checked against each of the four profiles: every class prints as displayed (ICC round trip < ΔE00 2), and printing no longer merges neighboring classes.

**How.** A CMYK gamut has no formula: it is measured, and described by an ICC profile. `scripts/build-cmyk-gamuts.ts` reads the profiles once with [jsColorEngine](https://github.com/glennwilton/jsColorEngine) (a development dependency only) and stores, per gamut, the maximum OKLCH chroma printable with every profile on a lightness × hue grid (0.02 × 5°, interpolated) and the lightest of their blacks. The tables weigh ≈ 1.7 KB gzip each; the library stays dependency-free.

**Exporting for print.** The palette is printable as is, so it must be converted to CMYK **without any compression**: relative colorimetric intent, **without black point compensation**, with the printer's profile. Worst case over the two profiles of each gamut, for the sequential and categorical palettes of the test set converted from sRGB (`pnpm diagnose:cmyk`):

| Conversion | `cmyk-coated`, ΔE00 p95 / max | `cmyk-uncoated`, ΔE00 p95 / max |
| --- | --- | --- |
| relative colorimetric | 1.4 / 1.8 | 1.4 / 1.6 |
| relative colorimetric + black point compensation | 4.5 / 5.9 | 8.9 / 9.2 |
| perceptual | 5.2 / 6.4 | 11.2 / 11.8 |

Black point compensation and the perceptual intent lighten the dark classes, which are already above the printable black. In Illustrator, InDesign or Photoshop: the printer's CMYK profile for the document, and in *Edit › Color Settings* (or *Convert to Profile*) the *Relative Colorimetric* intent with *Use Black Point Compensation* unchecked — Adobe's default European settings check it.

**Reading input colors.** Hex, named colors, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()` and `color(srgb | srgb-linear | display-p3 | xyz…)` are read in JS (also works in Node). Other syntaxes (`color-mix()`, relative colors, `var()`…) are resolved by the browser. If a color cannot be read (e.g. `var(--x)` outside a browser), the function falls back to its pure CSS output (`"none"`).

## API

### `sequential(options)`

Generates a sequential palette (monochrome or two-tone).

| Option       | Type                          | Default      | Description                                         |
| ------------ | ----------------------------- | ------------ | --------------------------------------------------- |
| `colorStart` | `string`                      | —            | CSS start color (light tones)                       |
| `colorEnd`   | `string?`                     | `colorStart` | CSS end color (dark tones). If omitted → monochrome |
| `steps`      | `number`                      | `5`          | Number of classes (2–12)                            |
| `contrast`   | `"low" \| "normal" \| "high"` | `"normal"`   | Contrast profile                                    |
| `gamut`      | [`Gamut`](#gamut)    | `"srgb"`     | Target gamut (see [Gamut](#gamut))                  |

**Returns** `string[]` — CSS colors `oklch(…)` (or `color-mix(in oklch, …)` with `gamut: "none"`).

#### How it works

The start color is normalized to a light tone (chroma divided by 1.5, 2.5 or 3.5 depending on the contrast profile, to avoid a fluorescent effect), the end color to a dark tone. The lightness range is automatically adapted to the number of classes via the contrast profile, inspired by ColorBrewer palette analysis:

- **3 classes** → ~30% lightness gap
- **9 classes** → ~70% lightness gap

Interpolation is done in OKLCH: in JS with `gamut: "srgb"` / `"p3"` (then each class is capped to the gamut), or delegated to the browser via `color-mix(in oklch, …)` with `gamut: "none"`. No color library is needed in either case.

### `divergent(options)`

Generates a diverging (bipolar) palette around a tinted pivot.

| Option           | Type                          | Default                | Description                      |
| ---------------- | ----------------------------- | ---------------------- | -------------------------------- |
| `colorA`         | `string`                      | —                      | Left-extreme CSS color           |
| `colorB`         | `string?`                     | complement of `colorA` | Right-extreme CSS color          |
| `steps`          | `[number, number]`            | `[3, 3]`               | Classes per side `[left, right]` |
| `contrast`       | `"low" \| "normal" \| "high"` | `"normal"`             | Contrast profile                 |
| `hasCenterClass` | `boolean`                     | `false`                | Add a neutral center class       |
| `colorSpace`     | `"oklab" \| "oklch"`          | `"oklab"`              | Ramp interpolation color space   |
| `gamut`          | [`Gamut`](#gamut)    | `"srgb"`               | Target gamut (see [Gamut](#gamut)) |

**Returns** `string[]` — CSS colors `oklch(…)` (or `color-mix(…)` with `gamut: "none"`).

#### How it works

Both extremes converge toward an automatically derived **tinted pivot**: the OkLab midpoint of light, highly-desaturated variants of A and B. Because A and B are opposite on the hue wheel, their components almost cancel in OkLab, producing a quasi-neutral, slightly-tinted tone — visually integrated rather than a foreign grey.

- `colorSpace: "oklab"` (default): Cartesian path — smoother, avoids hue artifacts
- `colorSpace: "oklch"`: circular path on the hue wheel — more saturated at the center

```ts
// Default symmetric palette (7 classes: 3 + 3)
divergent({ colorA: "#3b4cc0" });

// Asymmetric, high contrast, oklch interpolation
divergent({
  colorA: "#d7191c",
  colorB: "#2b83ba",
  steps: [5, 2],
  contrast: "high",
  colorSpace: "oklch",
});

// With a center class (3 + 1 + 3 classes)
divergent({ colorA: "steelblue", steps: [3, 3], hasCenterClass: true });
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
| `hasCenterClass` | `boolean`                     | `false`    | Add a neutral center class |
| `gamut`          | [`Gamut`](#gamut)    | `"srgb"`   | Target gamut (see [Gamut](#gamut)) |

**Returns** `string[]` — CSS colors `oklch(…)` (or `color-mix(…)` with `gamut: "none"`).

> With `contrast: "high"` and `hasCenterClass: true`, the lightest class of each side and the center class share a lightness of about 96–97 %, where sRGB holds very little chroma: once mapped to the gamut they can get very close (ΔE OK ≈ 0.013–0.02). Prefer `contrast: "normal"` or `divergent()` in that case.

```ts
// Rigorously identical to two mirrored `sequential` calls
divergentSequential({ colorA: "#3b4cc0" });

// Asymmetric with a center class
divergentSequential({
  colorA: "#d7191c",
  colorB: "#2b83ba",
  steps: [5, 2],
  hasCenterClass: true,
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
| `gamut`          | [`Gamut`](#gamut) | `"srgb"` | Target gamut: chroma cap (see [Gamut](#gamut)) |
| `baseColor`      | `string`           | —              | First color of the palette (any CSS color); the style of the next colors is derived from it (see [Starting from a color](#starting-from-a-color)) |

**Returns** `string[]` — CSS colors `oklch(…)`, all inside the target gamut.

#### Presets

```ts
presets.vif; // Saturated, vivid colors      — L 0.55–0.8,  C 0.15–0.22
presets.pastel; // Soft, light colors        — L 0.78–0.93, C 0.05–0.12
presets.sepia; // Warm, desaturated tones    — L 0.4–0.92,  C 0.03–0.08, hues 25°–85°
```

#### Temperature filters

```ts
temperature.mixte; // Full hue wheel
temperature.chaude; // Pinks, reds, oranges, golden yellows (330° → 450°)
temperature.froide; // Greens, cyans, blues, violets (140° → 300°)
```

Combining: `categorical(8, { ...presets.vif, ...temperature.chaude })`

#### Starting from a color

`baseColor` makes a given color (a brand color, the color of a main category…) the first color of the palette, and derives a style of comparable visual weight for the next ones:

```ts
categorical(6, { baseColor: "#e63946" });
categorical(6, { baseColor: "oklch(62% 0.2 25)", gamut: "p3" });
```

- **First color** — the color itself (a hex color round-trips exactly). Only its chroma is capped to the target `gamut`; with a CMYK gamut, its lightness is also brought inside the printable range.
- **Hue** — the hue range starts at the color's hue, which replaces `hueOffset` (ignored). On the full circle, the next hues are the usual Van der Corput steps from there (+180°, +90°, +270°…). An arc (≤ 270°, e.g. a temperature filter) keeps its span but is rotated to start at the color's hue: `{ ...temperature.chaude, baseColor }` gives hues spread over 120° from the color, not warm hues.
- **Lightness and chroma** — `lightnessRange` and `chromaRange` are recentred on the first color as displayed, i.e. with its chroma capped to the gamut (a color out of the gamut gives the same palette as its capped version, and the next colors keep a visual weight comparable to it), so that it falls exactly on the level the first color takes (80 % of the lightness range, 20 % of the chroma range): `lightnessRange = [L − 0.8·wL, L + 0.2·wL]` and `chromaRange = [C − 0.2·wC, C + 0.8·wC]`. A range that would leave [0, 1] (lightness) or go below 0 (chroma) is shifted back inside, keeping its width.
- **Widths** — `wL = 0.2` (the width of `presets.vif`) and `wC = 0.45 × C` (C capped, at least 0.02, so greys get some room). If `lightnessRange` or `chromaRange` are given, only their width is used: `{ ...presets.pastel, baseColor }` keeps the narrow chroma range of `pastel` around the color.
- **Stability** — unchanged: adding a class never changes the colors already generated.

A color that cannot be read (unknown syntax outside a browser) is ignored.

#### How it works

- **Hue** — distributed with the [Van der Corput sequence](https://en.wikipedia.org/wiki/Van_der_Corput_sequence) in base 2: the largest gap of the hue range is always filled next. A partial range of 270° or less (e.g. a temperature filter) is treated as an arc: its two ends are used by the first two colors, then the gaps are filled.
- **Lightness and chroma** — for each new color, 11 lightness levels of `lightnessRange` are tried (chroma follows the inverse level in `chromaRange`: light colors are less saturated). The level kept is the one farthest, in ΔE OK, from the colors already placed, weighted by the share of chroma the hue keeps inside sRGB (so yellows stay light and blues dark instead of turning olive or greyish). Levels where the hue keeps less than 60 % of the chroma it reaches on its best level are skipped: when the aimed chroma is out of the gamut (a very saturated `chromaRange`, a print gamut), no class falls on a light, nearly grey level much paler than the others.
- **Gamut** — chroma is capped to the maximum reachable in the target gamut (sRGB by default, Display P3, or sRGB ∩ CMYK for print) for that lightness and hue. The browser never has to clip the colors, so the lightness and chroma displayed are the ones computed.
- **Stability** — each color only depends on the previous ones: adding a class never changes the colors already generated.

The computation is deterministic and fast (≈ 0.3 ms for 16 colors in Node).

#### Limits

Low-chroma presets have little room to separate many classes. Measured minimal ΔE OK between two colors (sRGB, 2 to 16 classes): `vif` ≥ 0.09, `pastel` ≥ 0.05, `pastel` + `chaude` / `froide` ≥ 0.034, `sepia` ≥ 0.05 up to 12 classes (0.029 at 15). Below ≈ 0.05, neighboring areas on a map can be confused; prefer `vif`, or combine colors with patterns (`categoricalPatterns`).

#### Diagnostic

`pnpm diagnose:categorical` (Node ≥ 22.18, no dependency) prints, for every preset × temperature and 2 to 16 classes, the number of out-of-gamut colors and the minimal ΔE OK. Options: `--gamut p3` (palettes and screen in Display P3), `--max 24`, `--detail sepia,chaude,8` (colors of one palette), `--json`. See [`scripts/diagnose-categorical.ts`](scripts/diagnose-categorical.ts).

`pnpm diagnose:ramps` does the same for `sequential`, `divergent` and `divergentSequential`: for a set of input colors, class counts and contrast profiles, it compares `gamut: "none" | "srgb" | "p3"` on an sRGB and a Display P3 screen (out-of-gamut classes, ΔE OK between computed and displayed colors, neighboring classes that merge once displayed). Option `--detail sequential "oklch(52.4% 0.158 252.3)" 5` lists the classes of one palette. See [`scripts/diagnose-ramps.ts`](scripts/diagnose-ramps.ts).

### `categoricalPatterns(count, options?)`

Generates categorical pattern parameters compatible with [@ateliercartographie/motif.js](https://github.com/AtelierCartographie/motif.js).

| Option       | Type                                 | Default                                   | Description                                  |
| ------------ | ------------------------------------ | ----------------------------------------- | -------------------------------------------- |
| `shapes`     | `string[]`                           | `["line", "circle", "plaid", "triangle"]` | Shapes to cycle through                      |
| `angleRange` | `[number, number]`                   | `[0, 180]`                                | Angle range (degrees)                        |
| `scaleRange` | `[number, number]`                   | `[2, 8]`                                  | Scale range                                  |
| `size`       | `number`                             | `10`                                      | Fixed size                                   |
| `fill`       | `string`                             | `"#000000"`                               | Fill color                                   |
| `background` | `string`                             | `"#ffffff"`                               | Background color                             |
| `patchSize`  | `boolean`                            | `true`                                    | Enable patchSize                             |
| `vdcOffset`  | `number`                             | `0`                                       | Van der Corput offset                        |
| `colorize`   | `boolean \| CategoricalColorOptions` | `false`                                   | Auto-colorize pattern fill via `categorical` (pass `{ gamut: "p3" }` to change the gamut; `true` uses sRGB) |

**Returns** `PatternParams[]`

#### How it works

Pattern variation combines three complementary mechanisms so classes stay distinct without looking purely random:

- **Shape**: forms are assigned by cycling through `shapes` (`i % shapes.length`) to guarantee balanced reuse when `count` exceeds the shape list.
- **Scale**: values oscillate between `scaleRange[0]` and `scaleRange[1]` (triangle-wave style), creating contrast while avoiding monotonic growth that could suggest an ordered scale.
- **Angle**: orientation is sampled with the Van der Corput sequence, but independently **within each shape group**. In practice, each shape gets its own low-discrepancy angle stream, which spreads angles evenly and prevents two identical shapes from clustering around similar directions.

### `sequentialPatterns(count, options?)`

Generates sequential pattern parameters compatible with [@ateliercartographie/motif.js](https://github.com/AtelierCartographie/motif.js).

Pattern **size** increases monotonically across classes, analogous to the lightness range in sequential color palettes. The size range is adapted to both the class count and the contrast profile.

The shape is fixed to preserve the perception of order.

| Option       | Type                          | Default     | Description               |
| ------------ | ----------------------------- | ----------- | ------------------------- |
| `shape`      | `string`                      | `"line"`    | Pattern shape             |
| `sizeRange`  | `[number, number]`            | `[4, 14]`   | Size range [small, large] |
| `angle`      | `number`                      | `45`        | Fixed angle (degrees)     |
| `scale`      | `number`                      | `4`         | Fixed scale               |
| `contrast`   | `"low" \| "normal" \| "high"` | `"normal"`  | Contrast profile          |
| `fill`       | `string`                      | `"#000000"` | Fill color                |
| `background` | `string`                      | `"#ffffff"` | Background color          |
| `patchSize`  | `boolean`                     | `true`      | Enable patchSize          |

**Returns** `PatternParams[]`

### `resolveColor(color, options?)`

Resolves a complex CSS color (`color-mix(…)`, `oklch(from …)`, etc.) to a usable value.

- `{ format: "css" }` (default) → `string` as computed by the browser
- `{ format: "webgl" }` → `[r, g, b, a]` (0–255)

#### How it works

`resolveColor` delegates parsing and evaluation to the browser color engine: the input is applied to a temporary element/canvas context, then read back as a computed color.

This ensures full support for modern CSS color syntax (`oklch`, relative colors, `color-mix()`) without external dependencies and with behavior aligned to real rendering engines. The function then normalizes the result either as a CSS color string (`css`) or as a WebGL-ready numeric tuple (`webgl`).

### `resolvePalette(colors, options?)`

Applies `resolveColor` to an entire array of colors.

## Why this approach?

### Problem 1 — Color space

The choice of interpolation space dramatically changes the result. Using **oklch** guarantees perceptually uniform steps across each component (lightness, chroma, hue). As of 2025, oklch is supported by all modern browsers.

### Problem 2 — Lightness range

A sequential palette only works if the lightness gap between the first and last color is sufficient and adapted to the number of classes. This library automatically normalizes input colors to guarantee a readable result.

### Solution

- **Universal**: normalizes any CSS color before generating the palette
- **Modern**: zero dependencies, relies on native `oklch` (and `color-mix()` with `gamut: "none"`); gamut mapping to sRGB or Display P3 is computed in a few lines of JS, and to CMYK print from small precomputed tables
- **Performant**: categorical palettes are built in a single deterministic pass (Van der Corput hues, best of 11 lightness levels per color), unlike iterative approaches like I Want Hue

## Development

```bash
# Start the demo page
pnpm dev

# Build the library
pnpm build

# Run the tests (Node ≥ 22.18, node:test)
pnpm test

# Measure palettes (gamut, minimal ΔE OK)
pnpm diagnose:categorical
pnpm diagnose:ramps

# Measure palettes printed in CMYK (ICC round trip with jsColorEngine)
pnpm diagnose:cmyk

# Regenerate the CMYK gamut tables (src/cmyk-gamuts.data.ts) from ICC profiles
pnpm build:cmyk-gamuts

# sRGB → CMYK tables of the web generator (CMYK values export), not part of the library
pnpm build:cmyk-luts --out ../web-atelier/static/ok-palette/cmyk --check ../web-atelier/src/lib/data/ok-palette/cmyk.js
```

The CMYK scripts read four ICC profiles: FOGRA39 and FOGRA29 installed with Adobe Creative Cloud on macOS (`/Library/Application Support/Adobe/Color/Profiles/Recommended/`), and the ECI profiles [PSOcoated_v3.icc](https://registry.color.org/profile-registry/PSOcoated_v3) and [PSOuncoated_v3_FOGRA52.icc](https://registry.color.org/profile-registry/PSOuncoated_v3_FOGRA52) from the ICC registry, to put in `icc/`. That folder is not versioned: the profiles' licenses allow use, not redistribution. `--profile cmyk-coated=/a.icc,/b.icc` uses other files.

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
