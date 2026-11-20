import type { CategoricalColorPreset, Range } from "./types";

// ---------------------------------------------------------------------------
// Categorical presets
// ---------------------------------------------------------------------------

/**
 * Style presets for categorical palettes.
 *
 * Each preset defines hue, chroma and lightness ranges
 * that produce a distinct visual mood.
 */
export const presets = {
  vif: {
    hueRange: [0, 360] as Range,
    chromaRange: [0.15, 0.22] as Range,
    lightnessRange: [0.55, 0.8] as Range,
  },
  pastel: {
    hueRange: [0, 360] as Range,
    chromaRange: [0.05, 0.12] as Range,
    lightnessRange: [0.78, 0.93] as Range,
  },
  sepia: {
    hueRange: [25, 85] as Range,
    chromaRange: [0.03, 0.08] as Range,
    lightnessRange: [0.4, 0.92] as Range,
  },
} as const satisfies Record<string, CategoricalColorPreset>;

/**
 * Color temperature filters.
 *
 * Combined with a style preset (e.g. `{ ...presets.vif, ...temperature.chaude }`),
 * they restrict the palette to warm or cool hues.
 *
 * - `chaude`: pinks, reds, oranges, yellows (330° → 450°, 450° being 90°).
 *   It exceeds 360° to cover the pink → red → yellow transition without
 *   discontinuity.
 * - `froide`: greens, cyans, blues, violets (140° → 300°).
 *
 * Both are arcs: their two ends are used by the first two colors.
 */
export const temperature = {
  mixte: { hueRange: [0, 360] as Range },
  chaude: { hueRange: [330, 450] as Range },
  froide: { hueRange: [140, 300] as Range },
} as const satisfies Record<string, { hueRange: Range }>;

export type PresetName = keyof typeof presets;
export type TemperatureName = keyof typeof temperature;
