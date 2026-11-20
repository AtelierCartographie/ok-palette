// Copie de src/categorical.ts dont le plafond de chroma accepte un gamut CMJN injecté (globalThis.__cap) — prototype uniquement.
import type { CategoricalColorOptions, CSSColor } from "../../src/types.ts";
import { deltaEOK, maxChroma, oklchToOklab, type Oklab } from "../../src/oklab.ts";
import { lerp, vanDerCorput } from "../../src/utils.ts";

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

const round = (x: number, digits: number) => Math.round(x * 10 ** digits) / 10 ** digits;
const floor = (x: number, digits: number) => Math.floor(x * 10 ** digits) / 10 ** digits;

/**
 * Generates a categorical color palette.
 *
 * - **Hue** is distributed with the base-2 Van der Corput sequence: the largest
 *   gap of the hue range is always filled next. Partial ranges (arcs, e.g.
 *   temperature filters) use both of their ends first.
 * - **Lightness** is chosen, for each new color, among 11 levels of
 *   `lightnessRange`: the level whose color is farthest (ΔE OK) from all the
 *   colors already placed, favoring levels where the hue keeps its chroma.
 *   Chroma follows the inverse level in `chromaRange`.
 * - **Chroma** is capped to the maximum reachable in the target `gamut`
 *   (default `"srgb"`, or `"p3"`) for that lightness and hue, so every color is
 *   displayable as is (no browser clipping). `gamut: "none"` disables the cap.
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
 * ```
 */
export function categorical(
  count: number,
  {
    hueRange = [0, 360],
    hueOffset = 0,
    chromaRange = [0.15, 0.25],
    lightnessRange = [0.5, 0.75],
    gamut = "srgb",
  }: CategoricalColorOptions = {}
): CSSColor[] {
  const colors: CSSColor[] = [];
  const placed: Oklab[] = [];
  const isArc = Math.abs(hueRange[1] - hueRange[0]) <= MAX_ARC_SPAN;

  for (let i = 0; i < count; i++) {
    // Hue: Van der Corput for optimal distribution
    const rawHue = lerp(hueRange, hueFraction(i, isArc)) + hueOffset;
    const hue = round(((rawHue % 360) + 360) % 360, 2);

    // Lightness / chroma: the level farthest from the colors already placed,
    // weighted by the chroma it keeps inside the target gamut
    let best: { l: number; c: number; lab: Oklab; score: number } | undefined;

    for (const t of lightnessCandidates(i)) {
      const l = round(lerp(lightnessRange, t), 2);
      const target = round(lerp(chromaRange, 1 - t), 3);
      const cap = gamut === "none" ? Infinity : floor(Math.min(maxChroma(l, hue, "srgb"), (globalThis as any).__cap ? (globalThis as any).__cap(l, hue) : Infinity), 3);
      const c = Math.max(0, Math.min(target, cap));
      const lab = oklchToOklab(l, c, hue);

      const nearest = placed.reduce((min, other) => Math.min(min, deltaEOK(lab, other)), 1);
      const kept = target > 0 ? c / target : 1;
      const score = nearest * kept ** CHROMA_WEIGHT;

      if (!best || score > best.score) best = { l, c, lab, score };
    }

    placed.push(best!.lab);
    colors.push(`oklch(${Math.round(best!.l * 100)}% ${best!.c.toFixed(3)} ${hue.toFixed(2)})`);
  }

  return colors;
}
