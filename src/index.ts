// ---------------------------------------------------------------------------
// @ateliercartographie/ok-palette
// ---------------------------------------------------------------------------

// Generators — colors
export { sequential } from "./sequential";
export { divergent, divergentSequential } from "./divergent";
export { categorical } from "./categorical";

// Generators — patterns
export { categoricalPatterns, sequentialPatterns } from "./patterns";

// Color resolution
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
