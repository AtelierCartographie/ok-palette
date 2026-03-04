// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Profil de contraste pour les palettes séquentielles */
export type ContrastMode = "low" | "normal" | "high";

/** Format de sortie pour la résolution des couleurs */
export type ColorFormat = "css" | "webgl";

/** Couleur CSS résolue (ex: "oklch(70% 0.15 230)") */
export type CSSColor = string;

/** Couleur WebGL : tuple [r, g, b, a] avec valeurs 0–255 */
export type WebGLColor = [r: number, g: number, b: number, a: number];

/** Plage numérique [min, max] */
export type Range = [min: number, max: number];

// ---------------------------------------------------------------------------
// Palettes séquentielles
// ---------------------------------------------------------------------------

/** Profil de contraste : bornes de luminosité pour 3 classes et 9+ classes */
export interface ContrastProfile {
  /** Luminosité de départ [pour 3 classes, pour 9+ classes] */
  start: Range;
  /** Luminosité de fin [pour 3 classes, pour 9+ classes] */
  end: Range;
}

/** Ensemble des profils de contraste indexés par mode */
export type ContrastProfiles = Record<ContrastMode, ContrastProfile>;

/** Options pour la génération de palette séquentielle */
export interface SequentialPaletteOptions {
  /** Couleur de départ (CSS valide) – utilisée pour les tons clairs */
  colorStart: string;
  /** Couleur de fin (CSS valide) – si omise, palette monochrome */
  colorEnd?: string;
  /** Nombre de classes (défaut : 5) */
  steps?: number;
  /** Profil de contraste (défaut : "normal") */
  contrast?: ContrastMode;
}

/** Espace colorimétrique d'interpolation pour la palette divergente */
export type DivergentColorSpace = "oklab" | "oklch";

/** Options pour la génération de palette divergente */
export interface DivergentPaletteOptions {
  /** Couleur de l'extrême gauche (CSS valide) */
  colorA: string;
  /** Couleur de l'extrême droite (CSS valide) – si omise, utilise la complémentaire de colorA */
  colorB?: string;
  /** Nombre de classes par côté [gauche, droite] (défaut : [3, 3]) */
  steps?: [number, number];
  /** Profil de contraste (défaut : "normal") */
  contrast?: ContrastMode;
  /** Ajouter une classe neutre centrale (défaut : true) */
  hasCenterClass?: boolean;
  /**
   * Espace colorimétrique pour l'interpolation de chaque rampe (défaut : "oklab").
   * - "oklab" : trajectoire cartésienne — plus douce, évite les teintes parasites
   * - "oklch" : trajectoire circulaire sur la roue des teintes — plus saturée au centre
   */
  colorSpace?: DivergentColorSpace;
}

// ---------------------------------------------------------------------------
// Palettes catégorielles – couleurs
// ---------------------------------------------------------------------------

/** Preset de couleurs catégorielles */
export interface CategoricalColorPreset {
  hueRange?: Range;
  chromaRange?: Range;
  lightnessRange?: Range;
}

/** Options pour la génération de couleurs catégorielles */
export interface CategoricalColorOptions {
  /** Plage de teinte en degrés (défaut : [0, 360]) */
  hueRange?: Range;
  /** Plage de chroma oklch (défaut : [0.15, 0.25]) */
  chromaRange?: Range;
  /** Plage de luminosité oklch, valeurs 0–1 (défaut : [0.5, 0.75]) */
  lightnessRange?: Range;
}

/** Presets prédéfinis pour les couleurs catégorielles */
export interface CategoricalPresets {
  [key: string]: CategoricalColorPreset;
}

/** Filtres de température de couleur */
export interface TemperaturePresets {
  [key: string]: { hueRange: Range };
}

// ---------------------------------------------------------------------------
// Palettes catégorielles – motifs
// ---------------------------------------------------------------------------

/** Options pour la génération de motifs catégoriels */
export interface CategoricalPatternOptions {
  /** Formes à cycler (défaut : ["line", "circle", "plaid", "triangle"]) */
  shapes?: string[];
  /** Plage d'angles en degrés (défaut : [0, 180]) */
  angleRange?: Range;
  /** Plage d'échelles (défaut : [2, 8]) */
  scaleRange?: Range;
  /** Taille fixe – poids visuel constant (défaut : 10) */
  size?: number;
  /** Couleur de remplissage (défaut : "#ffffff") */
  fill?: string;
  /** Couleur de fond (défaut : "transparent") */
  background?: string;
  /** Activer patchSize (défaut : true) */
  patchSize?: boolean;
  /** Décalage dans la séquence de Van der Corput (défaut : 0) */
  vdcOffset?: number;
  /**
   * Coloriser automatiquement les motifs avec `categorical`.
   * - `true` → utilise les options par défaut de `categorical`
   * - objet → options passées à `categorical`
   */
  colorize?: boolean | CategoricalColorOptions;
}

/** Options pour la génération de motifs séquentiels */
export interface SequentialPatternOptions {
  /** Forme du motif (défaut : "line") */
  shape?: string;
  /** Plage de taille [petit, grand] (défaut : [4, 14]) */
  sizeRange?: Range;
  /** Angle fixe en degrés (défaut : 45) */
  angle?: number;
  /** Échelle fixe (défaut : 4) */
  scale?: number;
  /** Profil de contraste (défaut : "normal") */
  contrast?: ContrastMode;
  /** Couleur de remplissage (défaut : "#ffffff") */
  fill?: string;
  /** Couleur de fond (défaut : "transparent") */
  background?: string;
  /** Activer patchSize (défaut : true) */
  patchSize?: boolean;
}

/** Paramètres d'un motif (compatible motif.js) */
export interface PatternParams {
  type: string;
  angle: number;
  scale: number;
  size: number;
  fill: string;
  background: string;
  patchSize: boolean;
}
