// ---------------------------------------------------------------------------
// Target gamuts: chroma cap and lightness range of every `gamut` option value
// except `"none"`, and the formatting of capped `oklch()` colors.
// ---------------------------------------------------------------------------

import { cmykLightnessRange, cmykMaxChroma, isCmykGamut } from "./cmyk-gamuts";
import { maxChroma, type Oklch } from "./oklab";
import type { ContrastMode, Gamut, Range } from "./types";
import { getAdaptiveBounds, type AdaptiveBounds } from "./utils";

/** Every gamut a palette can be capped to */
export type TargetGamut = Exclude<Gamut, "none">;

/**
 * Maximum OKLCH chroma for a lightness and hue in the target gamut.
 * CMYK gamuts are intersected with sRGB: the palette must also display as
 * computed on every screen.
 */
export function gamutMaxChroma(l: number, h: number, gamut: TargetGamut): number {
  if (!isCmykGamut(gamut)) return maxChroma(l, h, gamut);
  return Math.min(maxChroma(l, h, "srgb"), cmykMaxChroma(l, h, gamut));
}

/** Usable OKLab lightness range of the target gamut ([0, 1] on screens) */
export function gamutLightnessRange(gamut: Gamut): Range {
  return isCmykGamut(gamut) ? cmykLightnessRange(gamut) : [0, 1];
}

/**
 * `getAdaptiveBounds` (percent) brought inside the lightness range of the
 * gamut. On paper, the darkest bound is raised to the printable black: below
 * it, the darkest classes would all print as the same black.
 */
export function gamutAdaptiveBounds(
  steps: number,
  contrast: ContrastMode,
  gamut: Gamut
): AdaptiveBounds {
  const { start, end } = getAdaptiveBounds(steps, contrast);
  const [min, max] = gamutLightnessRange(gamut).map((v) => v * 100);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return { start: clamp(start), end: clamp(end) };
}

/**
 * Lightness range brought inside the lightness range of the gamut (for
 * `categorical`'s `lightnessRange`). A range entirely outside collapses to
 * the nearest bound.
 */
export function clampLightnessRange([lo, hi]: Range, gamut: Gamut): Range {
  const [min, max] = gamutLightnessRange(gamut);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return [clamp(lo), clamp(hi)];
}

/**
 * How fast the chroma kept by a ramp may recover, per unit of ramp position
 * (0 = lightest class, 1 = darkest), away from its dark end. See
 * `smoothDarkChroma`.
 */
const DARK_CHROMA_SLOPE = 1;

/**
 * Spreads the chroma loss of the dark end of a ramp (ordered light → dark)
 * over its neighbors. CMYK gamuts only; other gamuts return the ramp as is.
 *
 * On paper, the gamut narrows toward the printable black: capped class by
 * class, the darkest classes lose most of their chroma at once while the
 * previous ones keep all of it, and the ramp breaks (the last class reads as
 * grey, out of the family). Here the share of chroma each class keeps is
 * bounded by that of the darker classes plus `DARK_CHROMA_SLOPE` × their
 * distance, so the ramp desaturates progressively toward its dark end.
 * Lightness and hue are unchanged; the light end is not affected.
 */
export function smoothDarkChroma(ramp: Oklch[], gamut: Gamut): Oklch[] {
  if (!isCmykGamut(gamut) || ramp.length < 2) return ramp;
  const n = ramp.length;
  const kept = ramp.map(([l, c, h]) => (c > 0 ? Math.min(1, gamutMaxChroma(l, h, gamut) / c) : 1));
  const factors = new Array<number>(n);
  let factor = 1;
  for (let i = n - 1; i >= 0; i--) {
    // min over darker classes j of kept[j] + slope × (t_j − t_i), computed from the dark end
    factor = Math.min(kept[i], i === n - 1 ? 1 : factor + DARK_CHROMA_SLOPE / (n - 1));
    factors[i] = factor;
  }
  return ramp.map(([l, c, h], i) => [l, c * factors[i], h]);
}

const roundTo = (x: number, digits: number) => Math.round(x * 10 ** digits) / 10 ** digits;
const floorTo = (x: number, digits: number) => Math.floor(x * 10 ** digits) / 10 ** digits;

/**
 * Formats an OKLCH color as a CSS `oklch()` string, with its chroma capped
 * to the given gamut (if any) after rounding lightness and hue.
 *
 * Output: `oklch(93.12% 0.0632 252.30)`.
 */
export function formatOklch([l, c, h]: Oklch, gamut?: TargetGamut): string {
  const L = roundTo(Math.min(1, Math.max(0, l)), 4);
  const H = roundTo(((h % 360) + 360) % 360, 2) % 360;
  let C = roundTo(Math.max(0, c), 4);
  if (gamut) C = Math.min(C, floorTo(gamutMaxChroma(L, H, gamut), 4));
  return `oklch(${(L * 100).toFixed(2)}% ${C.toFixed(4)} ${H.toFixed(2)})`;
}
