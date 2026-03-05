import type { CSSColor, DivergentPaletteOptions } from "./types";
import { getAdaptiveBounds } from "./utils";
import { sequential } from "./sequential";

/**
 * Génère une palette divergente (bi-polaire) autour d'un pivot teinté.
 *
 * La palette est construite en deux rampes indépendantes (gauche et droite)
 * convergeant vers un pivot neutre dérivé automatiquement des couleurs A et B.
 *
 * **Ce que la fonction gère automatiquement :**
 *
 * 1. **Couleur B complémentaire** : Si colorB n'est pas fournie, le CSS natif
 *    effectue une rotation de +180° sur la teinte de colorA.
 *
 * 2. **Pivot teinté** : Le pivot central n'est pas un gris pur (chroma=0) mais
 *    le point médian OkLab entre A et B, dont on force la luminance à startL.
 *    Comme A et B sont sur des côtés opposés de la roue des couleurs, leurs
 *    composantes a/b s'annulent presque entièrement dans OkLab, produisant un
 *    quasi-neutre très légèrement teinté — visuellement intégré à la palette
 *    plutôt qu'un gris "étranger".
 *
 * 3. **Intensité maximale sur chaque côté** : Les deux extrêmes atteignent
 *    toujours la même luminance cible (endL), quel que soit le nombre de classes.
 *    Les marches sont plus grandes du côté avec moins de classes.
 *
 * 4. **Gestion pair/impair** : `hasCenterClass` injecte explicitement le pivot
 *    comme classe centrale. Sans lui, les deux rampes s'arrêtent avant le pivot.
 *
 * 5. **Espace d'interpolation** : `colorSpace` contrôle si chaque rampe
 *    interpole en OkLab (trajectoire cartésienne, plus douce, évite les teintes
 *    parasites) ou en OkLCH (trajectoire circulaire sur la roue des teintes).
 *
 * @example
 * ```ts
 * // Palette symétrique par défaut (OkLab, 3+3 classes)
 * divergent({ colorA: "#3b4cc0" });
 *
 * // Asymétrique, contraste élevé, OkLCH
 * divergent({ colorA: "#d7191c", colorB: "#2b83ba", steps: [5, 2], contrast: "high", colorSpace: "oklch" });
 *
 * // Sans classe centrale (nombre de classes pair)
 * divergent({ colorA: "steelblue", steps: [4, 4], hasCenterClass: false });
 * ```
 */
export function divergent({
  colorA,
  colorB,
  steps = [3, 3],
  contrast = "normal",
  hasCenterClass = false,
  colorSpace = "oklab",
}: DivergentPaletteOptions): CSSColor[] {
  const [leftSteps, rightSteps] = steps;

  // startL = lightness of the center (light), endL = lightness of the extremes (dark).
  const { start: startL, end: endL } = getAdaptiveBounds(
    Math.max(leftSteps, rightSteps),
    contrast
  );

  // Extremes normalized to endL lightness (dark, saturated), avoiding nested
  // relative functions to stay compatible with current CSS engines.
  const cssA = `oklch(from ${colorA} ${endL.toFixed(1)}% c h)`;
  const cssB = colorB
    ? `oklch(from ${colorB} ${endL.toFixed(1)}% c h)`
    : `oklch(from ${colorA} ${endL.toFixed(1)}% c calc(h + 180))`;

  // Tinted pivot: first build two light variants (startL) with reduced chroma,
  // then take their OkLab midpoint.
  // Goal: avoid an abrupt pure grey while keeping a readable center.
  const pivotA = `oklch(from ${colorA} ${startL.toFixed(1)}% calc(c / 8) h)`;
  const pivotB = colorB
    ? `oklch(from ${colorB} ${startL.toFixed(1)}% calc(c / 8) h)`
    : `oklch(from ${colorA} ${startL.toFixed(1)}% calc(c / 8) calc(h + 180))`;
  const cssPivot = `color-mix(in oklab, ${pivotA}, ${pivotB} 50%)`;

  const palette: CSSColor[] = [];

  // LEFT RAMP: extreme A → pivot
  // i=0 → 0% pivot = pure extreme A
  // i=leftSteps-1 → (leftSteps-1)/leftSteps * 100% pivot → just before the pivot
  for (let i = 0; i < leftSteps; i++) {
    const pctPivot = leftSteps === 1 ? 0 : (i / leftSteps) * 100;
    palette.push(`color-mix(in ${colorSpace}, ${cssPivot} ${pctPivot.toFixed(1)}%, ${cssA})`);
  }

  // CENTER CLASS (optional)
  if (hasCenterClass) {
    palette.push(cssPivot);
  }

  // RIGHT RAMP: pivot → extreme B
  // Reversed loop to go from the hue closest to the pivot toward extreme B.
  for (let i = rightSteps - 1; i >= 0; i--) {
    const pctPivot = rightSteps === 1 ? 0 : (i / rightSteps) * 100;
    palette.push(`color-mix(in ${colorSpace}, ${cssPivot} ${pctPivot.toFixed(1)}%, ${cssB})`);
  }

  return palette;
}

/**
 * Generates a diverging palette built as two mirrored sequential palettes —
 * an approach that guarantees full consistency with `sequential()`.
 *
 * Each side is exactly identical to `sequential({ colorStart, steps, contrast })`
 * in monochrome mode. The left ramp is reversed (dark → light) to converge
 * toward the center; the right ramp is in natural order (light → dark).
 *
 * **Center class**: If `hasCenterClass` is `true`, a transition class is
 * inserted between the two ramps. It is computed as the OkLab blend of the
 * highly-desaturated (chroma/4) light variants of both colors, producing a
 * quasi-neutral, slightly tinted tone — softer than pure grey without
 * requiring an explicit pivot.
 *
 * @example
 * ```ts
 * // Symmetric 3+3 — rigorously identical to two mirrored `sequential` calls
 * divergentSequential({ colorA: "#3b4cc0" });
 *
 * // Asymmetric without center class
 * divergentSequential({ colorA: "#d7191c", colorB: "#2b83ba", steps: [5, 2], hasCenterClass: false });
 * ```
 */
export function divergentSequential({
  colorA,
  colorB,
  steps = [3, 3],
  contrast = "normal",
  hasCenterClass = false,
}: Omit<DivergentPaletteOptions, "colorSpace">): CSSColor[] {
  const [leftSteps, rightSteps] = steps;

  // Resolve colorB: pure CSS complement if not provided.
  // Note: the `oklch(from … l c calc(h + 180))` syntax is a valid relative color
  // that sequential() can accept as colorStart.
  const baseB = colorB ?? `oklch(from ${colorA} l c calc(h + 180))`;

  // LEFT RAMP: monochrome sequential of colorA, reversed (dark → light).
  // The result is rigorously identical to sequential({ colorStart: colorA }).
  const leftRamp = sequential({ colorStart: colorA, steps: leftSteps, contrast }).reverse();

  // RIGHT RAMP: monochrome sequential of colorB (light → dark).
  const rightRamp = sequential({ colorStart: baseB, steps: rightSteps, contrast });

  if (!hasCenterClass) {
    return [...leftRamp, ...rightRamp];
  }

  // CENTER CLASS: OkLab blend of the very light, very desaturated (chroma/4)
  // variants of A and B. The respective getAdaptiveBounds give the lightness
  // used by each ramp for its lightest class.
  // With chroma/4 (instead of chroma/2 in sequential), the center is perceptibly
  // more neutral than the first classes of the ramps, without being a pure grey.
  const { start: startL_left } = getAdaptiveBounds(leftSteps, contrast);
  const { start: startL_right } = getAdaptiveBounds(rightSteps, contrast);

  const lightA = `oklch(from ${colorA} ${startL_left.toFixed(1)}% 0.02 h)`;
  const lightB = colorB
    ? `oklch(from ${colorB} ${startL_right.toFixed(1)}% 0.02 h)`
    : `oklch(from ${colorA} ${startL_right.toFixed(1)}% 0.02 calc(h + 180))`;

  const centerClass = `color-mix(in oklab, ${lightA}, ${lightB} 50%)`;

  return [...leftRamp, centerClass, ...rightRamp];
}
