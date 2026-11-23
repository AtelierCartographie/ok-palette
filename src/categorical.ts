import type { CategoricalColorOptions, CSSColor, Range } from "./types";
import { clampLightnessRange, gamutLightnessRange, gamutMaxChroma } from "./gamut";
import { deltaEOK, oklabToOklch, oklchToOklab, type Oklab, type Oklch } from "./oklab";
import { readColor } from "./parse";
import { lerp, vanDerCorput } from "./utils";

/**
 * Candidate positions within `lightnessRange` (0 → min, 1 → max):
 * 11 evenly spaced levels, step 10 %.
 *
 * Chroma follows the inverse position within `chromaRange`
 * (light colors are less saturated, dark ones more), as before.
 */
const LIGHTNESS_LEVELS = Array.from({ length: 11 }, (_, k) => k / 10);

/**
 * Historical three-step oscillation (High → Low → Mid lightness).
 *
 * No longer applied blindly: it only sets the preferred lightness level
 * when several levels are equally good (first color, ties).
 */
const L_PREFERENCE = [0.8, 0.2, 0.5] as const;

/**
 * Weight of the chroma kept after gamut capping in the choice of a level.
 *
 * score = ΔE OK to the nearest placed color × (chroma kept / chroma aimed)^0.5
 *
 * Without it, the farthest level is sometimes one where the hue cannot hold
 * its chroma (dark yellows turn olive, light blues turn greyish).
 * 0.5 keeps hues near their gamut cusp at a small cost in minimal ΔE.
 */
const CHROMA_WEIGHT = 0.5;

/**
 * Minimal share of the reachable chroma a lightness level must keep to be
 * considered at all.
 *
 * The reachable chroma of a level is its target chroma, bounded by the best
 * chroma the hue holds on any level of `lightnessRange` inside the gamut.
 * Without this cut, when the aimed chroma is out of the gamut on every level
 * (a very saturated base color, a print gamut), a light and nearly grey level
 * is often the farthest from colors that are all saturated, and wins despite
 * the chroma weight: that class looks much paler than the others.
 *
 * At 0.6, no palette of the vif, pastel and sepia presets changes in sRGB or P3.
 */
const MIN_CHROMA_SHARE = 0.6;

/**
 * Hue ranges spanning at most this many degrees are treated as an arc
 * (both ends are used); wider ranges are treated as a full circle.
 */
const MAX_ARC_SPAN = 270;

/**
 * Position of the i-th color within the hue range, in [0, 1].
 *
 * - Full circle: base-2 Van der Corput (0, ½, ¼, ¾, ⅛…). The end of the range
 *   coincides with its start, so it is never used.
 * - Arc: both ends are used first (0, 1), then Van der Corput fills the gaps
 *   (½, ¼, ¾, ⅛…). Without this, an arc never reaches its end and the second
 *   color sits in the middle of the range.
 */
function hueFraction(i: number, isArc: boolean): number {
  if (!isArc) return i === 0 ? 0 : vanDerCorput(i);
  if (i < 2) return i;
  return vanDerCorput(i - 1);
}

/** Lightness levels ordered by preference for the i-th color */
function lightnessCandidates(i: number): number[] {
  const preferred = L_PREFERENCE[i % 3];
  return [...LIGHTNESS_LEVELS].sort(
    (a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || b - a
  );
}

/**
 * `baseColor`: default width of the lightness range (that of `presets.vif`,
 * rounded) and of the chroma range, relative to the chroma of the color
 * (at least `BASE_MIN_C_WIDTH`, so greys still get some room).
 */
const BASE_L_WIDTH = 0.2;
const BASE_C_RATIO = 0.45;
const BASE_MIN_C_WIDTH = 0.02;

/**
 * Lightness level of the first color within `lightnessRange` (its chroma
 * level being `1 − BASE_LEVEL` within `chromaRange`): `baseColor` sets the
 * ranges so that this level falls on the color.
 */
const BASE_LEVEL = L_PREFERENCE[0];

/**
 * Ranges recentred on `baseColor`, keeping their width: the color sits at
 * level `BASE_LEVEL` of the lightness range and `1 − BASE_LEVEL` of the
 * chroma range. A range that would leave [0, 1] (lightness) or go below 0
 * (chroma) is shifted back inside, keeping its width.
 */
function rangesAroundColor(
  [l, c]: Oklch,
  lWidth: number,
  cWidth: number
): { lightnessRange: Range; chromaRange: Range } {
  const lw = Math.min(1, Math.max(0, lWidth));
  const cw = Math.max(0, cWidth);
  const lLow = Math.min(1 - lw, Math.max(0, l - BASE_LEVEL * lw));
  const cLow = Math.max(0, c - (1 - BASE_LEVEL) * cw);
  return { lightnessRange: [lLow, lLow + lw], chromaRange: [cLow, cLow + cw] };
}

const round = (x: number, digits: number) => Math.round(x * 10 ** digits) / 10 ** digits;
const floor = (x: number, digits: number) => Math.floor(x * 10 ** digits) / 10 ** digits;

/**
 * `oklch(L% C H)`. L has 2 decimals in percent at most (`63%`, `62.84%`);
 * C has 3 decimals, 4 for `baseColor` (so that a hex color round-trips).
 */
const formatColor = (l: number, c: number, h: number, cDigits = 3): CSSColor =>
  `oklch(${round(l * 100, 2)}% ${c.toFixed(cDigits)} ${h.toFixed(2)})`;

/**
 * Generates a categorical color palette.
 *
 * - **Hue** is distributed with the base-2 Van der Corput sequence: the largest
 *   gap of the hue range is always filled next. Partial ranges (arcs, e.g.
 *   temperature filters) use both of their ends first.
 * - **Lightness** is chosen, for each new color, among 11 levels of
 *   `lightnessRange`: the level whose color is farthest (ΔE OK) from all the
 *   colors already placed, favoring levels where the hue keeps its chroma.
 *   Levels keeping less than 60 % of the chroma the hue can reach on its best
 *   level are skipped, so no class is much paler than the others when the
 *   aimed chroma is out of the gamut.
 *   Chroma follows the inverse level in `chromaRange`.
 * - **Chroma** is capped to the maximum reachable in the target `gamut`
 *   (default `"srgb"`, or `"p3"`) for that lightness and hue, so every color is
 *   displayable as is (no browser clipping). With a CMYK gamut
 *   (`"cmyk-coated"`, `"cmyk-uncoated"`), to what is both displayable in sRGB and printable, and
 *   `lightnessRange` is kept above the deepest printable black.
 *   `gamut: "none"` disables the cap.
 *
 * With `baseColor`, the first color is that color (its chroma capped to the
 * gamut, its lightness kept inside a CMYK gamut's printable range), and the
 * next ones keep a comparable visual weight: the hue range starts at its hue
 * (`hueOffset` is ignored; an arc keeps its span but is rotated to start
 * there), and `lightnessRange` / `chromaRange` are recentred around it. Their
 * width comes from the options when given, otherwise 0.2 in lightness and
 * 45 % of the color's chroma (at least 0.02) in chroma. A color that cannot be
 * read (unknown syntax outside a browser) is ignored.
 *
 * Each color only depends on the previous ones: adding a class never changes
 * the colors already generated.
 *
 * Style presets (vif, pastel, sepia, etc.) and temperature filters
 * (mixte, chaude, froide) are configured via the range options.
 *
 * @example
 * ```ts
 * // 8 vivid colors across the full hue wheel
 * categorical(8);
 *
 * // 5 pastel colors
 * categorical(5, { chromaRange: [0.05, 0.12], lightnessRange: [0.78, 0.93] });
 *
 * // 6 warm colors
 * categorical(6, { hueRange: [330, 450] });
 *
 * // 4 colors with a starting hue offset of 45°
 * categorical(4, { hueOffset: 45 });
 *
 * // 6 colors, the first one being the brand color
 * categorical(6, { baseColor: "#e63946" });
 * ```
 */
export function categorical(count: number, options: CategoricalColorOptions = {}): CSSColor[] {
  let {
    hueRange = [0, 360],
    hueOffset = 0,
    chromaRange = [0.15, 0.25],
    lightnessRange = [0.5, 0.75],
  } = options;
  const { gamut = "srgb", baseColor } = options;
  const colors: CSSColor[] = [];
  const placed: Oklab[] = [];

  const lab = baseColor === undefined ? null : readColor(baseColor);
  const color = lab && oklabToOklch(lab);
  // baseColor: the first color is the color itself (rounded finer than the
  // other levels), only brought inside the gamut. The ranges are recentred on
  // this displayed color, not on the requested one: otherwise, for a color out
  // of the gamut, the whole chroma range aims out of the gamut too.
  let first: Oklch | null = null;
  if (color) {
    const [min, max] = gamutLightnessRange(gamut);
    const l = round(Math.min(max, Math.max(min, color[0])), 4);
    const h = round(((color[2] % 360) + 360) % 360, 2);
    const cap = gamut === "none" ? Infinity : gamutMaxChroma(l, h, gamut);
    first = [l, Math.max(0, Math.min(round(color[1], 4), floor(cap, 4))), h];
    // Chroma the ranges are centred on: unrounded, so in-gamut colors keep the
    // ranges they always had
    const c = Math.max(0, Math.min(color[1], cap));

    const width = (r: Range | undefined, fallback: number) =>
      r ? Math.abs(r[1] - r[0]) : fallback;
    ({ lightnessRange, chromaRange } = rangesAroundColor(
      [color[0], c, h],
      width(options.lightnessRange, BASE_L_WIDTH),
      width(options.chromaRange, Math.max(BASE_MIN_C_WIDTH, c * BASE_C_RATIO))
    ));
    hueOffset = color[2] - hueRange[0];
  }
  const isArc = Math.abs(hueRange[1] - hueRange[0]) <= MAX_ARC_SPAN;
  // On paper, colors darker than the printable black all print as that black
  const lRange = clampLightnessRange(lightnessRange, gamut);

  for (let i = 0; i < count; i++) {
    // Hue: Van der Corput for optimal distribution
    const rawHue = lerp(hueRange, hueFraction(i, isArc)) + hueOffset;
    const hue = round(((rawHue % 360) + 360) % 360, 2);

    if (i === 0 && first) {
      placed.push(oklchToOklab(...first));
      colors.push(formatColor(...first, 4));
      continue;
    }

    // Lightness / chroma: the level farthest from the colors already placed,
    // weighted by the chroma it keeps inside the target gamut
    const levels = lightnessCandidates(i).map((t) => {
      const l = round(lerp(lRange, t), 2);
      const target = round(lerp(chromaRange, 1 - t), 3);
      const cap = gamut === "none" ? Infinity : floor(gamutMaxChroma(l, hue, gamut), 3);
      return { l, target, c: Math.max(0, Math.min(target, cap)) };
    });
    // Best chroma this hue can hold on any level (within the targets)
    const reachable = Math.max(...levels.map((v) => v.c));

    let best: { l: number; c: number; lab: Oklab; score: number } | undefined;

    for (const { l, target, c } of levels) {
      // Skip levels that lose much more chroma than the hue has to
      const ref = Math.min(target, reachable);
      if (ref > 0 && c < MIN_CHROMA_SHARE * ref) continue;

      const lab = oklchToOklab(l, c, hue);
      const nearest = placed.reduce((min, other) => Math.min(min, deltaEOK(lab, other)), 1);
      const kept = target > 0 ? c / target : 1;
      const score = nearest * kept ** CHROMA_WEIGHT;

      if (!best || score > best.score) best = { l, c, lab, score };
    }

    placed.push(best!.lab);
    colors.push(formatColor(best!.l, best!.c, hue));
  }

  return colors;
}
