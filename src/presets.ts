import type { CategoricalColorPreset, Range } from "./types";

// ---------------------------------------------------------------------------
// Presets catégoriels
// ---------------------------------------------------------------------------

/**
 * Presets de style pour les palettes catégorielles.
 *
 * Chaque preset définit des plages de teinte, chroma et luminosité
 * qui produisent une ambiance visuelle distincte.
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
 * Filtres de température de couleur.
 *
 * Combinés avec un preset de style (ex: `{ ...presets.vif, ...temperature.chaude }`),
 * ils permettent de restreindre la palette à des teintes chaudes ou froides.
 *
 * Note : `chaude` dépasse 360° pour couvrir la transition rouge → jaune
 * sans discontinuité.
 */
export const temperature = {
  mixte: { hueRange: [0, 360] as Range },
  chaude: { hueRange: [300, 480] as Range },
  froide: { hueRange: [120, 300] as Range },
} as const satisfies Record<string, { hueRange: Range }>;

export type PresetName = keyof typeof presets;
export type TemperatureName = keyof typeof temperature;
