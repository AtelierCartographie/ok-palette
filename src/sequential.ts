import type { CSSColor, SequentialPaletteOptions } from "./types";
import { getAdaptiveBounds } from "./utils";

/**
 * Generates a sequential palette (monochrome or two-tone).
 *
 * The start color is normalized to a light tone (chroma reduced according to the
 * contrast profile to avoid a fluorescent effect), the end color to a dark tone.
 * The lightness range is automatically adapted to the number of classes
 * via the chosen contrast profile.
 *
 * Interpolation relies entirely on `color-mix(in oklch, …)`:
 * no external dependency is needed — the browser does the computation.
 *
 * @example
 * ```ts
 * // 5-class monochrome palette
 * sequential({ colorStart: "steelblue" });
 *
 * // 7-class two-tone palette, high contrast
 * sequential({ colorStart: "#f4e285", colorEnd: "#1d3557", steps: 7, contrast: "high" });
 * ```
 */
export function sequential({
  colorStart,
  colorEnd,
  steps = 5,
  contrast = "normal",
}: SequentialPaletteOptions): CSSColor[] {
  // Mono or two-tone: if no end color provided, reuse the start color
  const endColor = colorEnd ?? colorStart;

  const { start: startL, end: endL } = getAdaptiveBounds(steps, contrast);

  // Normalize the start color (light):
  // reduce chroma according to the contrast profile to avoid a fluorescent effect.
  // - low : c / 1.5 (less aggressive)
  // - normal : c / 2.5 (balanced)
  // - high : c / 3.5 (more neutral)
  const chromaFactor = contrast === "low" ? 1.5 : contrast === "high" ? 3.5 : 2.5;
  const cssStart = `oklch(from ${colorStart} ${startL.toFixed(1)}% calc(c / ${chromaFactor}) h)`;

  // Normalize the end color (dark):
  // preserve the original chroma.
  const cssEnd = `oklch(from ${endColor} ${endL.toFixed(1)}% c h)`;

  const palette: CSSColor[] = [];
  for (let i = 0; i < steps; i++) {
    const pct = steps === 1 ? 0 : (i / (steps - 1)) * 100;
    palette.push(`color-mix(in oklch, ${cssStart}, ${cssEnd} ${pct}%)`);
  }

  return palette;
}
