import type { ContrastMode, ContrastProfiles, Range } from "./types";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Nombre minimum / maximum de classes pour l'interpolation du contraste */
const MIN_STEPS = 3;
const MAX_STEPS = 9;

/**
 * Profils de contraste prédéfinis.
 *
 * Chaque profil définit des bornes de départ et de fin sous forme de plage
 * [valeur pour 3 classes, valeur pour 9+ classes].
 * L'interpolation se fait linéairement entre ces deux extrêmes.
 *
 * Utilisé à la fois pour la luminosité des palettes de couleurs
 * et pour la taille progressive des palettes de motifs.
 */
export const CONTRAST_PROFILES: ContrastProfiles = {
  low: {
    start: [85, 90],
    end: [70, 50],
  },
  normal: {
    start: [90, 97],
    end: [60, 25],
  },
  high: {
    start: [96, 99],
    end: [40, 10],
  },
};

// ---------------------------------------------------------------------------
// Séquence de Van der Corput
// ---------------------------------------------------------------------------

/**
 * Séquence de Van der Corput en base 2.
 *
 * Retourne un réel dans [0, 1[ qui divise l'intervalle de façon optimale.
 * Garantit que les k premiers points sont toujours les k mieux espacés.
 *
 * VdC(0) = 0, VdC(1) = 0.5, VdC(2) = 0.25, VdC(3) = 0.75, VdC(4) = 0.125…
 */
export function vanDerCorput(n: number): number {
  let result = 0;
  let p = 0.5;
  while (n > 0) {
    if (n & 1) result += p;
    n >>= 1;
    p /= 2;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Bornes adaptatives (générique)
// ---------------------------------------------------------------------------

/** Résultat des bornes adaptatives */
export interface AdaptiveBounds {
  start: number;
  end: number;
}

/**
 * Calcule des bornes adaptatives en fonction du nombre de classes
 * et du profil de contraste choisi.
 *
 * L'interpolation est linéaire : à 3 classes on utilise la borne « peu de
 * classes », à 9+ on utilise la borne « beaucoup de classes ».
 *
 * C'est la brique commune utilisée pour :
 * - la luminosité des palettes de couleurs séquentielles
 * - la taille progressive des palettes de motifs séquentiels
 */
export function getAdaptiveBounds(
  steps: number,
  mode: ContrastMode = "normal"
): AdaptiveBounds {
  const profile = CONTRAST_PROFILES[mode] ?? CONTRAST_PROFILES.normal;

  // Facteur t normalisé entre 0 (3 classes) et 1 (9+ classes)
  const t = Math.min(1, Math.max(0, (steps - MIN_STEPS) / (MAX_STEPS - MIN_STEPS)));

  const start = profile.start[0] + t * (profile.start[1] - profile.start[0]);
  const end = profile.end[0] + t * (profile.end[1] - profile.end[0]);

  return { start, end };
}

// ---------------------------------------------------------------------------
// Interpolation linéaire
// ---------------------------------------------------------------------------

/**
 * Interpole linéairement dans une plage [min, max] pour un facteur t ∈ [0, 1].
 */
export function lerp(range: Range, t: number): number {
  return range[0] + t * (range[1] - range[0]);
}
