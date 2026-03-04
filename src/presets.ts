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
    lightnessRange: [0.6, 0.8] as Range,
  },
  pastel: {
    hueRange: [0, 360] as Range,
    chromaRange: [0.05, 0.1] as Range,
    lightnessRange: [0.8, 0.9] as Range,
  },
  sepia: {
    hueRange: [50, 90] as Range,
    chromaRange: [0.02, 0.05] as Range,
    lightnessRange: [0.6, 0.9] as Range,
  },
} as const satisfies Record<string, CategoricalColorPreset>;

/**
 * Color temperature filters.
 *
 * Combined with a style preset (e.g. `{ ...presets.vif, ...temperature.chaude }`),
 * they restrict the palette to warm or cool hues.
 *
 * Note: `chaude` exceeds 360° to cover the red → yellow transition
 * without discontinuity.
 */
export const temperature = {
  mixte: { hueRange: [0, 360] as Range },
  chaude: { hueRange: [300, 480] as Range },
  froide: { hueRange: [120, 300] as Range },
} as const satisfies Record<string, { hueRange: Range }>;

export type PresetName = keyof typeof presets;
export type TemperatureName = keyof typeof temperature;
