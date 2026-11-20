// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Contrast profile for sequential palettes */
export type ContrastMode = "low" | "normal" | "high";

/**
 * CMYK offset printing gamuts a palette can be constrained to. Each one is
 * the intersection of both generations of ISO 12647-2 printing conditions,
 * so the palette prints whichever profile the printer uses:
 *
 * - `"cmyk-coated"`: coated paper (FOGRA39 / ISO Coated v2 and FOGRA51 / PSO Coated v3);
 * - `"cmyk-uncoated"`: uncoated paper (FOGRA29 / ISO Uncoated and FOGRA52 / PSO Uncoated v3).
 */
export type CmykGamut = "cmyk-coated" | "cmyk-uncoated";

/**
 * Target gamut of the generated colors.
 *
 * - `"srgb"`: every color fits the sRGB gamut (all screens). Chroma is
 *   computed in JS and capped per class.
 * - `"p3"`: every color fits the Display P3 gamut (recent Mac, iPhone and
 *   most recent laptop screens). sRGB screens clip what exceeds sRGB.
 * - `"cmyk-coated"` / `"cmyk-uncoated"` (see {@link CmykGamut}): every color fits both
 *   sRGB and the CMYK printing condition, so it prints as it is displayed.
 *   Chroma is capped to what the press can print, and the darkest classes
 *   are kept above the deepest printable black.
 * - `"none"`: no gamut mapping. Sequential and divergent palettes are pure
 *   CSS (`color-mix()`, relative colors), computed by the browser.
 */
export type Gamut = "srgb" | "p3" | CmykGamut | "none";

/** Output format for color resolution */
export type ColorFormat = "css" | "webgl";

/** Resolved CSS color (e.g. "oklch(70% 0.15 230)") */
export type CSSColor = string;

/** WebGL color: tuple [r, g, b, a] with values 0–255 */
export type WebGLColor = [r: number, g: number, b: number, a: number];

/** Numeric range [min, max] */
export type Range = [min: number, max: number];

// ---------------------------------------------------------------------------
// Sequential palettes
// ---------------------------------------------------------------------------

/** Contrast profile: lightness bounds for 3 classes and 9+ classes */
export interface ContrastProfile {
  /** Start lightness [for 3 classes, for 9+ classes] */
  start: Range;
  /** End lightness [for 3 classes, for 9+ classes] */
  end: Range;
}

/** Set of contrast profiles indexed by mode */
export type ContrastProfiles = Record<ContrastMode, ContrastProfile>;

/** Options for sequential palette generation */
export interface SequentialPaletteOptions {
  /** Start CSS color – used for light tones */
  colorStart: string;
  /** End CSS color – if omitted, produces a monochrome palette */
  colorEnd?: string;
  /** Number of classes (default: 5) */
  steps?: number;
  /** Contrast profile (default: "normal") */
  contrast?: ContrastMode;
  /** Target gamut (default: "srgb") */
  gamut?: Gamut;
}

/** Interpolation color space for divergent palettes */
export type DivergentColorSpace = "oklab" | "oklch";

/** Options for divergent palette generation */
export interface DivergentPaletteOptions {
  /** Left-extreme color (valid CSS) */
  colorA: string;
  /** Right-extreme color (valid CSS) – if omitted, uses the complement of colorA */
  colorB?: string;
  /** Number of classes per side [left, right] (default: [3, 3]) */
  steps?: [number, number];
  /** Contrast profile (default: "normal") */
  contrast?: ContrastMode;
  /** Add a neutral center class (default: false) */
  hasCenterClass?: boolean;
  /**
   * Color space for interpolating each ramp (default: "oklab").
   * - "oklab": Cartesian path — smoother, avoids hue artifacts
   * - "oklch": Circular path on the hue wheel — more saturated at the center
   */
  colorSpace?: DivergentColorSpace;
  /** Target gamut (default: "srgb") */
  gamut?: Gamut;
}

// ---------------------------------------------------------------------------
// Categorical palettes – colors
// ---------------------------------------------------------------------------

/** Categorical color preset */
export interface CategoricalColorPreset {
  hueRange?: Range;
  chromaRange?: Range;
  lightnessRange?: Range;
}

/** Options for categorical color generation */
export interface CategoricalColorOptions {
  /** Hue range in degrees (default: [0, 360]) */
  hueRange?: Range;
  /** Hue offset (rotation) in degrees, applied to all colors (default: 0) */
  hueOffset?: number;
  /** Oklch chroma range (default: [0.15, 0.25]) */
  chromaRange?: Range;
  /** Oklch lightness range, values 0–1 (default: [0.5, 0.75]) */
  lightnessRange?: Range;
  /** Target gamut (default: "srgb") */
  gamut?: Gamut;
}

/** Predefined categorical color presets */
export interface CategoricalPresets {
  [key: string]: CategoricalColorPreset;
}

/** Color temperature filters */
export interface TemperaturePresets {
  [key: string]: { hueRange: Range };
}

// ---------------------------------------------------------------------------
// Categorical palettes – patterns
// ---------------------------------------------------------------------------

/** Options for categorical pattern generation */
export interface CategoricalPatternOptions {
  /** Shapes to cycle through (default: ["line", "circle", "plaid", "triangle"]) */
  shapes?: string[];
  /** Angle range in degrees (default: [0, 180]) */
  angleRange?: Range;
  /** Scale range (default: [2, 8]) */
  scaleRange?: Range;
  /** Fixed size – constant visual weight (default: 10) */
  size?: number;
  /** Fill color (default: "#ffffff") */
  fill?: string;
  /** Background color (default: "transparent") */
  background?: string;
  /** Enable patchSize (default: true) */
  patchSize?: boolean;
  /** Offset into the Van der Corput sequence (default: 0) */
  vdcOffset?: number;
  /**
   * Automatically colorize patterns using `categorical`.
   * - `true` → uses default `categorical` options
   * - object → options passed to `categorical`
   */
  colorize?: boolean | CategoricalColorOptions;
}

/** Options for sequential pattern generation */
export interface SequentialPatternOptions {
  /** Pattern shape (default: "line") */
  shape?: string;
  /** Size range [small, large] (default: [4, 14]) */
  sizeRange?: Range;
  /** Fixed angle in degrees (default: 45) */
  angle?: number;
  /** Fixed scale (default: 4) */
  scale?: number;
  /** Contrast profile (default: "normal") */
  contrast?: ContrastMode;
  /** Fill color (default: "#ffffff") */
  fill?: string;
  /** Background color (default: "transparent") */
  background?: string;
  /** Enable patchSize (default: true) */
  patchSize?: boolean;
}

/** Pattern parameters (compatible with motif.js) */
export interface PatternParams {
  type: string;
  angle: number;
  scale: number;
  size: number;
  fill: string;
  background: string;
  patchSize: boolean;
}
