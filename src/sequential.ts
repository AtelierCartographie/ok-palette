import type { CSSColor, SequentialPaletteOptions } from "./types";
import { getAdaptiveBounds } from "./utils";

/**
 * Génère une palette séquentielle (monochrome ou bi-tons).
 *
 * La couleur de départ est normalisée en ton clair (chroma réduite de moitié
 * pour éviter l'effet fluo), la couleur de fin en ton sombre.
 * L'écart de luminosité est adapté automatiquement au nombre de classes
 * grâce au profil de contraste choisi.
 *
 * L'interpolation repose entièrement sur `color-mix(in oklch, …)` :
 * aucune dépendance externe n'est nécessaire, le navigateur fait le calcul.
 *
 * @example
 * ```ts
 * // Palette monochrome 5 classes
 * sequential({ colorStart: "steelblue" });
 *
 * // Palette bi-tons 7 classes, contraste élevé
 * sequential({ colorStart: "#f4e285", colorEnd: "#1d3557", steps: 7, contrast: "high" });
 * ```
 */
export function sequential({
  colorStart,
  colorEnd,
  steps = 5,
  contrast = "normal",
}: SequentialPaletteOptions): CSSColor[] {
  // Mono ou bichrome : si pas de couleur de fin, on utilise la même
  const endColor = colorEnd ?? colorStart;

  const { start: startL, end: endL } = getAdaptiveBounds(steps, contrast);

  // Normalisation de la couleur de début (claire) :
  // on réduit la chroma de moitié pour éviter l'effet fluo sur les tons clairs.
  const cssStart = `oklch(from ${colorStart} ${startL.toFixed(1)}% calc(c / 2) h)`;

  // Normalisation de la couleur de fin (sombre) :
  // on conserve la chroma originale.
  const cssEnd = `oklch(from ${endColor} ${endL.toFixed(1)}% c h)`;

  const palette: CSSColor[] = [];
  for (let i = 0; i < steps; i++) {
    const pct = steps === 1 ? 0 : (i / (steps - 1)) * 100;
    palette.push(`color-mix(in oklch, ${cssStart}, ${cssEnd} ${pct}%)`);
  }

  return palette;
}
