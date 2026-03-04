import type {
  CategoricalColorOptions,
  CategoricalPatternOptions,
  PatternParams,
  SequentialPatternOptions,
} from "./types";
import { categorical } from "./categorical";
import { getAdaptiveBounds, lerp, vanDerCorput } from "./utils";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/**
 * Three-level oscillation factors for scale variation.
 * Dense → Open → Medium (same logic as L/C in categorical colors).
 */
const SCALE_FACTORS = [0, 1, 0.5] as const;

// ---------------------------------------------------------------------------
// Categorical
// ---------------------------------------------------------------------------

/**
 * Generates a categorical pattern palette (parameters for motif.js).
 *
 * The parallel with `categorical` (colors) is as follows:
 * - **Shape**  ↔ Hue category (most perceptible dimension, strict cycle)
 * - **Angle**  ↔ Hue value (distributed with Van der Corput)
 * - **Scale**  ↔ Chroma (secondary variation, 3 oscillating levels)
 * - **Size**   ↔ Lightness (fixed → constant visual weight)
 *
 * @example
 * ```ts
 * categoricalPatterns(6);
 * categoricalPatterns(4, { shapes: ["line", "circle"], fill: "#333" });
 * ```
 */
export function categoricalPatterns(
  count: number,
  {
    shapes = ["line", "circle", "plaid", "triangle"],
    angleRange = [0, 180],
    scaleRange = [2, 8],
    size = 25,
    fill = "#000000",
    background = "#ffffff",
    patchSize = true,
    vdcOffset = 0,
    colorize = false,
  }: CategoricalPatternOptions = {}
): PatternParams[] {
  const n = shapes.length;
  const palette = colorize
    ? categorical(
        count,
        typeof colorize === "object" ? (colorize as CategoricalColorOptions) : undefined
      )
    : undefined;

  return Array.from({ length: count }, (_, i) => {
    const shapeIndex = i % n;
    const round = Math.floor(i / n);
    const shape = shapes[shapeIndex];

    // Angle: Van der Corput per shape with offset to space sequences.
    // Each shape follows its own VdC progression, shifted by a prime number
    // to avoid similar angles between occurrences of the same shape.
    const shapeOffset = shapeIndex * 17; // prime number
    const angleFraction = vanDerCorput(round + vdcOffset + shapeOffset);
    const angle = Math.round(lerp(angleRange, angleFraction));

    // Scale: three-phase oscillation (dense → open → medium) per pattern
    const scale = +lerp(scaleRange, SCALE_FACTORS[i % 3]).toFixed(2);
    const patternFill = palette?.[i] ?? fill;

    return { type: shape, angle, scale, size, fill: patternFill, background, patchSize };
  });
}

// ---------------------------------------------------------------------------
// Sequential
// ---------------------------------------------------------------------------

/**
 * Generates a sequential pattern palette (parameters for motif.js).
 *
 * Pattern **size** increases monotonically across classes,
 * analogous to the lightness range in color palettes.
 * The size range is adapted to the number of classes and contrast profile,
 * exactly as in `sequential` (colors).
 *
 * The shape is fixed to preserve the perception of order.
 *
 * @example
 * ```ts
 * // 5 line patterns, normal contrast
 * sequentialPatterns(5);
 *
 * // 7 circle patterns, high contrast, size 2→20
 * sequentialPatterns(7, { shape: "circle", contrast: "high", sizeRange: [2, 20] });
 * ```
 */
export function sequentialPatterns(
  count: number,
  {
    shape = "line",
    sizeRange = [10, 90],
    angle = 45,
    scale = 3,
    contrast = "normal",
    fill = "#000000",
    background = "#ffffff",
    patchSize = true,
  }: SequentialPatternOptions = {}
): PatternParams[] {
  // Adaptive bounds: retrieve start/end (0–100 profile values)
  // then normalize to a 0–1 factor for interpolating within sizeRange.
  const { start, end } = getAdaptiveBounds(count, contrast);

  return Array.from({ length: count }, (_, i) => {
    // Linear progression factor (0 → 1)
    const t = count <= 1 ? 0 : i / (count - 1);

    // Interpolation: start (high %) → small size, end (low %) → large size
    // Normalize contrast bounds (0–100) to a factor (0–1)
    const sizeFactor = (start + t * (end - start)) / 100;
    // Inversion: high start = light = small pattern, low end = dark = large pattern
    const size = lerp(sizeRange, 1 - sizeFactor);

    return {
      type: shape,
      angle,
      scale,
      size: Math.round(+size),
      fill,
      background,
      patchSize,
    };
  });
}
