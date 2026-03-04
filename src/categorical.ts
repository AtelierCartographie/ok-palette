import type { CategoricalColorOptions, CSSColor } from "./types";
import { lerp, vanDerCorput } from "./utils";

/**
 * Facteurs d'oscillation sur 3 niveaux.
 *
 * Utilisé pour la luminosité et la chroma afin de créer du contraste
 * perceptif entre couleurs voisines dans le cercle chromatique.
 *
 * - Luminosité : Bas → Haut → Moyen
 * - Chroma     : Haut → Bas → Moyen (inversé pour équilibrer)
 */
const L_FACTORS = [0.8, 0.2, 0.5] as const;
const C_FACTORS = [0.2, 0.8, 0.5] as const;

/**
 * Génère une palette catégorielle de couleurs.
 *
 * La teinte est répartie de façon optimale grâce à la séquence de
 * Van der Corput en base 2 : le plus grand « trou » dans le cercle
 * chromatique est systématiquement comblé.
 *
 * Luminosité et chroma oscillent sur un cycle de 3 pour maximiser
 * le contraste perceptif entre voisins.
 *
 * Les presets (vif, pastel, sépia, etc.) et filtres de température
 * (mixte, chaude, froide) se paramètrent via les plages passées en options.
 *
 * @example
 * ```ts
 * // 8 couleurs vives sur tout le cercle
 * categorical(8);
 *
 * // 5 couleurs pastel
 * categorical(5, { chromaRange: [0.05, 0.1], lightnessRange: [0.8, 0.9] });
 *
 * // 6 couleurs chaudes
 * categorical(6, { hueRange: [300, 480] });
 * ```
 */
export function categorical(
  count: number,
  {
    hueRange = [0, 360],
    chromaRange = [0.15, 0.25],
    lightnessRange = [0.5, 0.75],
  }: CategoricalColorOptions = {}
): CSSColor[] {
  const colors: CSSColor[] = [];

  for (let i = 0; i < count; i++) {
    // Teinte : Van der Corput pour une répartition optimale
    const fraction = i === 0 ? 0 : vanDerCorput(i);
    const hue = lerp(hueRange, fraction);

    // Luminosité : oscillation tri-phase pour contraste entre voisins
    const lightness = lerp(lightnessRange, L_FACTORS[i % 3]);

    // Chroma : oscillation tri-phase inversée
    const chroma = lerp(chromaRange, C_FACTORS[i % 3]);

    colors.push(
      `oklch(${Math.round(lightness * 100)}% ${chroma.toFixed(3)} ${hue.toFixed(2)})`
    );
  }

  return colors;
}
