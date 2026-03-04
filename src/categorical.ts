import type { CategoricalColorOptions, CSSColor } from "./types";
import { lerp, vanDerCorput } from "./utils";

/**
 * Three-level oscillation factors.
 *
 * Used for lightness and chroma to create perceptual contrast
 * between adjacent colors on the hue wheel.
 *
 * - Lightness: Low → High → Mid
 * - Chroma:    High → Low → Mid (inverted for balance)
 */
const L_FACTORS = [0.8, 0.2, 0.5] as const;
const C_FACTORS = [0.2, 0.8, 0.5] as const;

/**
 * Generates a categorical color palette.
 *
 * Hues are distributed optimally using the base-2 Van der Corput sequence:
 * the largest gap on the hue wheel is always filled next.
 *
 * Lightness and chroma oscillate over a 3-step cycle to maximize
 * perceptual contrast between neighboring colors.
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
 * categorical(5, { chromaRange: [0.05, 0.1], lightnessRange: [0.8, 0.9] });
 *
 * // 6 warm colors
 * categorical(6, { hueRange: [300, 480] });
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
  }: CategoricalColorOptions = {}
): CSSColor[] {
  const colors: CSSColor[] = [];

  for (let i = 0; i < count; i++) {
    // Hue: Van der Corput for optimal distribution
    const fraction = i === 0 ? 0 : vanDerCorput(i);
    const hue = (lerp(hueRange, fraction) + hueOffset) % 360;

    // Lightness: three-phase oscillation for contrast between neighbors
    const lightness = lerp(lightnessRange, L_FACTORS[i % 3]);

    // Chroma: inverted three-phase oscillation
    const chroma = lerp(chromaRange, C_FACTORS[i % 3]);

    colors.push(
      `oklch(${Math.round(lightness * 100)}% ${chroma.toFixed(3)} ${hue.toFixed(2)})`
    );
  }

  return colors;
}
