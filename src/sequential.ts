import type { ContrastMode, CSSColor, Gamut, SequentialPaletteOptions } from "./types";
import { formatOklch, gamutAdaptiveBounds, smoothDarkChroma } from "./gamut";
import { mixOklch, oklabToOklch, type Oklch } from "./oklab";
import { readColor } from "./parse";
import { getAdaptiveBounds } from "./utils";

/**
 * Chroma divisor of the light (start) color, per contrast profile,
 * to avoid a fluorescent effect.
 * - low : c / 1.5 (less aggressive)
 * - normal : c / 2.5 (balanced)
 * - high : c / 3.5 (more neutral)
 */
function chromaFactor(contrast: ContrastMode): number {
  return contrast === "low" ? 1.5 : contrast === "high" ? 3.5 : 2.5;
}

/**
 * Generates a sequential palette (monochrome or two-tone).
 *
 * The start color is normalized to a light tone (chroma reduced according to the
 * contrast profile to avoid a fluorescent effect), the end color to a dark tone.
 * The lightness range is automatically adapted to the number of classes
 * via the chosen contrast profile.
 *
 * With `gamut: "srgb"` (default) or `"p3"`, colors are computed in JS (same
 * interpolation as the CSS version) and returned as `oklch()` whose chroma is
 * capped, class by class, to the maximum of the target gamut for that
 * lightness and hue (lightness and hue are kept). With a CMYK gamut
 * (`"cmyk-coated"`, `"cmyk-uncoated"`), the chroma is capped to what is both displayable
 * in sRGB and printable, and the dark end of the lightness range is raised to
 * the deepest printable black (the ramp is spread over a shorter range); the
 * chroma lost near that black is spread over the darkest classes, so the ramp
 * does not break (see `smoothDarkChroma`).
 * With `gamut: "none"`, the
 * palette is pure CSS (`color-mix(in oklch, …)`), computed by the browser.
 * If an input color cannot be read in JS (e.g. `var(--x)` outside a browser),
 * the pure CSS palette is returned.
 *
 * @example
 * ```ts
 * // 5-class monochrome palette
 * sequential({ colorStart: "steelblue" });
 *
 * // 7-class two-tone palette, high contrast
 * sequential({ colorStart: "#f4e285", colorEnd: "#1d3557", steps: 7, contrast: "high" });
 *
 * // Display P3 screens
 * sequential({ colorStart: "oklch(52.4% 0.158 252.3)", gamut: "p3" });
 * ```
 */
export function sequential({
  colorStart,
  colorEnd,
  steps = 5,
  contrast = "normal",
  gamut = "srgb",
}: SequentialPaletteOptions): CSSColor[] {
  if (gamut !== "none") {
    const start = readColor(colorStart);
    const end = colorEnd === undefined ? start : readColor(colorEnd);
    if (start && end) {
      const ramp = sequentialOklch(oklabToOklch(start), oklabToOklch(end), steps, contrast, gamut);
      return smoothDarkChroma(ramp, gamut).map((color) => formatOklch(color, gamut));
    }
  }
  return sequentialCss(colorStart, colorEnd ?? colorStart, steps, contrast);
}

/**
 * Sequential palette as OKLCH numbers: JS equivalent of the CSS version
 * (what the browser computes for `gamut: "none"`). Gamut mapping is applied
 * afterwards, class by class (see `formatOklch`): capping the anchors before
 * interpolating would needlessly dull the mid tones. `gamut` only brings the
 * lightness bounds inside the printable range of CMYK gamuts.
 *
 * @internal
 */
export function sequentialOklch(
  start: Oklch,
  end: Oklch,
  steps: number,
  contrast: ContrastMode,
  gamut: Gamut = "none"
): Oklch[] {
  const { start: startL, end: endL } = gamutAdaptiveBounds(steps, contrast, gamut);
  const light: Oklch = [startL / 100, start[1] / chromaFactor(contrast), start[2]];
  const dark: Oklch = [endL / 100, end[1], end[2]];

  return Array.from({ length: steps }, (_, i) =>
    mixOklch(light, dark, steps === 1 ? 0 : i / (steps - 1))
  );
}

/** Pure CSS sequential palette (`gamut: "none"`) */
function sequentialCss(
  colorStart: string,
  endColor: string,
  steps: number,
  contrast: ContrastMode
): CSSColor[] {
  const { start: startL, end: endL } = getAdaptiveBounds(steps, contrast);

  // Normalize the start color (light): reduce chroma per contrast profile.
  const cssStart = `oklch(from ${colorStart} ${startL.toFixed(1)}% calc(c / ${chromaFactor(contrast)}) h)`;

  // Normalize the end color (dark): preserve the original chroma.
  const cssEnd = `oklch(from ${endColor} ${endL.toFixed(1)}% c h)`;

  const palette: CSSColor[] = [];
  for (let i = 0; i < steps; i++) {
    const pct = steps === 1 ? 0 : (i / (steps - 1)) * 100;
    palette.push(`color-mix(in oklch, ${cssStart}, ${cssEnd} ${pct}%)`);
  }

  return palette;
}
