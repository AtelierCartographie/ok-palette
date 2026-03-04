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
  hasCenterClass = true,
  colorSpace = "oklab",
}: DivergentPaletteOptions): CSSColor[] {
  const [leftSteps, rightSteps] = steps;

  // startL = luminance du centre (clair), endL = luminance des extrêmes (sombre).
  const { start: startL, end: endL } = getAdaptiveBounds(
    Math.max(leftSteps, rightSteps),
    contrast
  );

  // Extrêmes normés à la luminance endL (sombre, saturé), sans imbrication
  // de fonctions relatives pour rester compatible avec les moteurs CSS actuels.
  const cssA = `oklch(from ${colorA} ${endL.toFixed(1)}% c h)`;
  const cssB = colorB
    ? `oklch(from ${colorB} ${endL.toFixed(1)}% c h)`
    : `oklch(from ${colorA} ${endL.toFixed(1)}% c calc(h + 180))`;

  // Pivot teinté : on construit d'abord deux variantes claires (startL) avec
  // chroma réduite, puis on prend leur milieu en OkLab.
  // Objectif : éviter le "gris pur" abrupt tout en gardant un centre lisible.
  const pivotA = `oklch(from ${colorA} ${startL.toFixed(1)}% calc(c / 3) h)`;
  const pivotB = colorB
    ? `oklch(from ${colorB} ${startL.toFixed(1)}% calc(c / 3) h)`
    : `oklch(from ${colorA} ${startL.toFixed(1)}% calc(c / 3) calc(h + 180))`;
  const cssPivot = `color-mix(in oklab, ${pivotA}, ${pivotB} 50%)`;

  const palette: CSSColor[] = [];

  // RAMPE GAUCHE : extrême A → pivot
  // i=0 → 0% pivot = extrême A pur
  // i=leftSteps-1 → (leftSteps-1)/leftSteps * 100% pivot → juste avant le pivot
  for (let i = 0; i < leftSteps; i++) {
    const pctPivot = leftSteps === 1 ? 0 : (i / leftSteps) * 100;
    palette.push(`color-mix(in ${colorSpace}, ${cssPivot} ${pctPivot.toFixed(1)}%, ${cssA})`);
  }

  // CLASSE CENTRALE (optionnelle)
  if (hasCenterClass) {
    palette.push(cssPivot);
  }

  // RAMPE DROITE : pivot → extrême B
  // Boucle inversée pour aller de la teinte proche du pivot vers l'extrême B.
  for (let i = rightSteps - 1; i >= 0; i--) {
    const pctPivot = rightSteps === 1 ? 0 : (i / rightSteps) * 100;
    palette.push(`color-mix(in ${colorSpace}, ${cssPivot} ${pctPivot.toFixed(1)}%, ${cssB})`);
  }

  return palette;
}

/**
 * Génère une palette divergente construite comme deux palettes séquentielles
 * miroir — une approche qui garantit une cohérence totale avec `sequential()`.
 *
 * Chaque côté est exactement identique à `sequential({ colorStart, steps, contrast })`
 * en mode monochrome. La rampe gauche est inversée (sombre → clair) pour converger
 * vers le centre, la rampe droite est dans l'ordre naturel (clair → sombre).
 *
 * **Classe centrale** : Si `hasCenterClass` est `true`, une classe de transition
 * est insérée entre les deux rampes. Elle est calculée comme le mélange OkLab des
 * versions très désaturées (chroma/4) des deux couleurs, produisant un quasi-neutre
 * légèrement teinté — plus doux qu'un gris pur sans exiger un pivot explicite.
 *
 * @example
 * ```ts
 * // Symétrique 3+3 — rigoureusement identique à deux `sequential` miroir
 * divergentSequential({ colorA: "#3b4cc0" });
 *
 * // Asymétrique sans classe centrale
 * divergentSequential({ colorA: "#d7191c", colorB: "#2b83ba", steps: [5, 2], hasCenterClass: false });
 * ```
 */
export function divergentSequential({
  colorA,
  colorB,
  steps = [3, 3],
  contrast = "normal",
  hasCenterClass = true,
}: Omit<DivergentPaletteOptions, "colorSpace">): CSSColor[] {
  const [leftSteps, rightSteps] = steps;

  // Résolution de colorB : complémentaire CSS pur si non fournie.
  // Note : la syntaxe `oklch(from … l c calc(h + 180))` est une couleur relative
  // valide que sequential() peut accepter comme colorStart.
  const baseB = colorB ?? `oklch(from ${colorA} l c calc(h + 180))`;

  // RAMPE GAUCHE : sequential monochrome de colorA, inversé (sombre → clair).
  // Le résultat est rigoureusement identique à sequential({ colorStart: colorA }).
  const leftRamp = sequential({ colorStart: colorA, steps: leftSteps, contrast }).reverse();

  // RAMPE DROITE : sequential monochrome de colorB (clair → sombre).
  const rightRamp = sequential({ colorStart: baseB, steps: rightSteps, contrast });

  if (!hasCenterClass) {
    return [...leftRamp, ...rightRamp];
  }

  // CLASSE CENTRALE : mélange OkLab des variantes très claires et très désaturées
  // (chroma/4) de A et B. Les getAdaptiveBounds respectifs donnent la luminance
  // utilisée par chaque ramp pour sa classe la plus claire.
  // Avec chroma/4 (au lieu de chroma/2 dans sequential), le centre est perceptiblement
  // plus neutre que les premières classes des rampes, sans être un gris pur.
  const { start: startL_left } = getAdaptiveBounds(leftSteps, contrast);
  const { start: startL_right } = getAdaptiveBounds(rightSteps, contrast);

  const lightA = `oklch(from ${colorA} ${startL_left.toFixed(1)}% calc(c / 4) h)`;
  const lightB = colorB
    ? `oklch(from ${colorB} ${startL_right.toFixed(1)}% calc(c / 4) h)`
    : `oklch(from ${colorA} ${startL_right.toFixed(1)}% calc(c / 4) calc(h + 180))`;

  const centerClass = `color-mix(in oklab, ${lightA}, ${lightB} 50%)`;

  return [...leftRamp, centerClass, ...rightRamp];
}
