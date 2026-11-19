// ---------------------------------------------------------------------------
// OKLab / OKLCH ↔ sRGB conversions (Björn Ottosson, https://bottosson.github.io/posts/oklab/)
//
// Internal helpers used to keep categorical colors inside the sRGB gamut
// and to measure perceptual distances (ΔE OK) between them.
// ---------------------------------------------------------------------------

/** Color in OKLab: [L (0–1), a, b] */
export type Oklab = [L: number, a: number, b: number];

/** Color in linear or gamma-encoded sRGB: [r, g, b], 0–1 inside the gamut */
export type Rgb = [r: number, g: number, b: number];

/** Tolerance used for gamut checks (absorbs floating-point noise) */
const GAMUT_EPSILON = 1e-4;

/** OKLCH (hue in degrees) → OKLab */
export function oklchToOklab(l: number, c: number, h: number): Oklab {
  const rad = (h * Math.PI) / 180;
  return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

/** OKLab → linear sRGB */
export function oklabToLinearSrgb([L, a, b]: Oklab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Linear sRGB → OKLab */
export function linearSrgbToOklab([r, g, b]: Rgb): Oklab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Whether a linear sRGB color lies inside the sRGB gamut */
export function isLinearSrgbInGamut(rgb: Rgb): boolean {
  return rgb.every((v) => v >= -GAMUT_EPSILON && v <= 1 + GAMUT_EPSILON);
}

/** Whether an OKLCH color lies inside the sRGB gamut */
export function isOklchInGamut(l: number, c: number, h: number): boolean {
  return isLinearSrgbInGamut(oklabToLinearSrgb(oklchToOklab(l, c, h)));
}

/**
 * Maximum OKLCH chroma reachable in sRGB for a given lightness and hue.
 *
 * Computed by bisection (the in-gamut region is convex along the chroma axis
 * for a fixed lightness and hue). Precision: ~1e-5.
 */
export function maxChroma(l: number, h: number): number {
  if (l <= 0 || l >= 1) return 0;
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (isOklchInGamut(l, mid, h)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** sRGB transfer function (linear → gamma-encoded) */
function encode(v: number): number {
  const abs = Math.abs(v);
  const out = abs <= 0.0031308 ? 12.92 * abs : 1.055 * abs ** (1 / 2.4) - 0.055;
  return Math.sign(v) * out;
}

/** sRGB transfer function (gamma-encoded → linear) */
function decode(v: number): number {
  const abs = Math.abs(v);
  const out = abs <= 0.04045 ? abs / 12.92 : ((abs + 0.055) / 1.055) ** 2.4;
  return Math.sign(v) * out;
}

/**
 * OKLCH → OKLab of the color actually displayed on an sRGB screen,
 * i.e. after per-channel clipping of the gamma-encoded values
 * (what browsers do today for out-of-gamut colors).
 */
export function oklchToDisplayedOklab(l: number, c: number, h: number): Oklab {
  const rgb = oklabToLinearSrgb(oklchToOklab(l, c, h));
  const clipped = rgb.map((v) => decode(Math.min(1, Math.max(0, encode(v))))) as Rgb;
  return linearSrgbToOklab(clipped);
}

/** Euclidean distance in OKLab (ΔE OK) */
export function deltaEOK(a: Oklab, b: Oklab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
