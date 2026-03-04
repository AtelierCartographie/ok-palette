// ---------------------------------------------------------------------------
// @ateliercartographie/palette-generator
// ---------------------------------------------------------------------------

// Générateurs — couleurs
export { sequential } from "./sequential";
export { divergent, divergentSequential } from "./divergent";
export { categorical } from "./categorical";

// Générateurs — motifs
export { categoricalPatterns, sequentialPatterns } from "./patterns";

// Résolution de couleurs
export { resolveColor, resolvePalette } from "./resolve";

// Presets & configuration
export { presets, temperature } from "./presets";
export { CONTRAST_PROFILES, vanDerCorput, getAdaptiveBounds } from "./utils";

// Types
export type {
  ContrastMode,
  ColorFormat,
  CSSColor,
  WebGLColor,
  Range,
  ContrastProfile,
  ContrastProfiles,
  SequentialPaletteOptions,
  DivergentPaletteOptions,
  DivergentColorSpace,
  CategoricalColorOptions,
  CategoricalColorPreset,
  CategoricalPatternOptions,
  SequentialPatternOptions,
  PatternParams,
} from "./types";

export type { AdaptiveBounds } from "./utils";
export type { PresetName, TemperatureName } from "./presets";
