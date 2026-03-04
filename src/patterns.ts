import type {
  CategoricalColorOptions,
  CategoricalPatternOptions,
  PatternParams,
  SequentialPatternOptions,
} from "./types";
import { categorical } from "./categorical";
import { getAdaptiveBounds, lerp, vanDerCorput } from "./utils";

// ---------------------------------------------------------------------------
// Constantes partagées
// ---------------------------------------------------------------------------

/**
 * Facteurs d'oscillation sur 3 niveaux pour la variation d'échelle.
 * Dense → Aéré → Médium (même logique que L/C dans categorical colors).
 */
const SCALE_FACTORS = [0, 1, 0.5] as const;

// ---------------------------------------------------------------------------
// Catégoriel
// ---------------------------------------------------------------------------

/**
 * Génère une palette catégorielle de motifs (paramètres pour motif.js).
 *
 * Le parallèle avec `categorical` (couleurs) est le suivant :
 * - **Forme**  ↔ Catégorie de teinte (dimension la plus perceptible, cycle strict)
 * - **Angle**  ↔ Valeur de teinte (distribué avec Van der Corput)
 * - **Échelle** ↔ Chroma (variation secondaire, 3 niveaux oscillants)
 * - **Taille** ↔ Luminosité (fixe → poids visuel constant)
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

    // Angle : Van der Corput par forme avec offset pour espacer les séquences.
    // Chaque forme suit sa propre progression VdC, décalée par un nombre premier
    // pour éviter les angles similaires entre occurrences de la même forme.
    const shapeOffset = shapeIndex * 17; // nombre premier
    const angleFraction = vanDerCorput(round + vdcOffset + shapeOffset);
    const angle = Math.round(lerp(angleRange, angleFraction));

    // Échelle : oscillation tri-phase (dense → aéré → médium) par pattern
    const scale = +lerp(scaleRange, SCALE_FACTORS[i % 3]).toFixed(2);
    const patternFill = palette?.[i] ?? fill;

    return { type: shape, angle, scale, size, fill: patternFill, background, patchSize };
  });
}

// ---------------------------------------------------------------------------
// Séquentiel
// ---------------------------------------------------------------------------

/**
 * Génère une palette séquentielle de motifs (paramètres pour motif.js).
 *
 * La **taille** du motif progresse de façon monotone entre les classes,
 * analogue à l'écart de luminosité dans les palettes de couleurs.
 * L'écart de taille est adapté au nombre de classes et au profil de
 * contraste, exactement comme pour `sequential` (couleurs).
 *
 * La forme reste fixe pour préserver la perception d'ordre.
 *
 * @example
 * ```ts
 * // 5 motifs lignes, contraste normal
 * sequentialPatterns(5);
 *
 * // 7 motifs cercles, contraste élevé, taille 2→20
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
  // Bornes adaptatives : on récupère start/end (valeurs 0–100 du profil)
  // puis on les normalise en facteur 0–1 pour interpoler dans sizeRange.
  const { start, end } = getAdaptiveBounds(count, contrast);

  return Array.from({ length: count }, (_, i) => {
    // Facteur de progression linéaire (0 → 1)
    const t = count <= 1 ? 0 : i / (count - 1);

    // Interpolation : start (grand %) → petite taille, end (petit %) → grande taille
    // On normalise les bornes de contraste (0–100) en facteur (0–1)
    const sizeFactor = (start + t * (end - start)) / 100;
    // Inversion : start haut = clair = petit motif, end bas = sombre = grand motif
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
