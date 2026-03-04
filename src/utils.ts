import type { ContrastMode, ContrastProfiles, Range } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum / maximum number of classes for contrast interpolation */
const MIN_STEPS = 3;
const MAX_STEPS = 9;

/**
 * Predefined contrast profiles.
 *
 * Each profile defines start and end bounds as a range
 * [value for 3 classes, value for 9+ classes].
 * Interpolation is linear between these two extremes.
 *
 * Used for both lightness in color palettes
 * and progressive size in pattern palettes.
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
// Van der Corput sequence
// ---------------------------------------------------------------------------

/**
 * Van der Corput sequence in base 2.
 *
 * Returns a real number in [0, 1) that splits the interval optimally.
 * Guarantees that the first k points are always the k best-spaced ones.
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
// Adaptive bounds (generic)
// ---------------------------------------------------------------------------

/** Result of adaptive bounds computation */
export interface AdaptiveBounds {
  start: number;
  end: number;
}

/**
 * Computes adaptive bounds based on the number of classes
 * and the chosen contrast profile.
 *
 * Interpolation is linear: at 3 classes the "few classes" bound is used,
 * at 9+ the "many classes" bound is used.
 *
 * This is the shared building block used for:
 * - lightness in sequential color palettes
 * - progressive size in sequential pattern palettes
 */
export function getAdaptiveBounds(
  steps: number,
  mode: ContrastMode = "normal"
): AdaptiveBounds {
  const profile = CONTRAST_PROFILES[mode] ?? CONTRAST_PROFILES.normal;

  // Normalized factor t between 0 (3 classes) and 1 (9+ classes)
  const t = Math.min(1, Math.max(0, (steps - MIN_STEPS) / (MAX_STEPS - MIN_STEPS)));

  const start = profile.start[0] + t * (profile.start[1] - profile.start[0]);
  const end = profile.end[0] + t * (profile.end[1] - profile.end[0]);

  return { start, end };
}

// ---------------------------------------------------------------------------
// Linear interpolation
// ---------------------------------------------------------------------------

/**
 * Linearly interpolates within a range [min, max] for a factor t ∈ [0, 1].
 */
export function lerp(range: Range, t: number): number {
  return range[0] + t * (range[1] - range[0]);
}
