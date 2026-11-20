// ---------------------------------------------------------------------------
// OKLab / OKLCH ↔ sRGB / Display P3 conversions
// (Björn Ottosson, https://bottosson.github.io/posts/oklab/ ; CSS Color 4)
//
// Internal helpers used to keep colors inside a target gamut
// and to measure perceptual distances (ΔE OK) between them.
// ---------------------------------------------------------------------------

/** Color in OKLab: [L (0–1), a, b] */
export type Oklab = [L: number, a: number, b: number];

/** Color in OKLCH: [L (0–1), C, H (degrees)] */
export type Oklch = [L: number, C: number, H: number];

/** Color in linear or gamma-encoded RGB: [r, g, b], 0–1 inside the gamut */
export type Rgb = [r: number, g: number, b: number];

/** RGB gamuts a color can be checked against */
export type RgbGamut = "srgb" | "p3";

/** Tolerance used for gamut checks (absorbs floating-point noise) */
const GAMUT_EPSILON = 1e-4;

/** Below this chroma, the hue of an OKLCH color is considered powerless */
export const ACHROMATIC_EPSILON = 1e-4;

// ---------------------------------------------------------------------------
// OKLab ↔ OKLCH
// ---------------------------------------------------------------------------

/** OKLCH (hue in degrees) → OKLab */
export function oklchToOklab(l: number, c: number, h: number): Oklab {
  const rad = (h * Math.PI) / 180;
  return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

/** OKLab → OKLCH (hue in [0, 360)) */
export function oklabToOklch([L, a, b]: Oklab): Oklch {
  const c = Math.hypot(a, b);
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return [L, c, h];
}

// ---------------------------------------------------------------------------
// OKLab ↔ linear sRGB
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Linear sRGB ↔ linear Display P3 (same D65 white point)
// ---------------------------------------------------------------------------

/** Linear sRGB → linear Display P3 */
export function linearSrgbToLinearP3([r, g, b]: Rgb): Rgb {
  return [
    0.8224621209 * r + 0.177537994 * g,
    0.0331941989 * r + 0.9668058011 * g,
    0.0170826307 * r + 0.0723974407 * g + 0.9105199286 * b,
  ];
}

/** Linear Display P3 → linear sRGB */
export function linearP3ToLinearSrgb([r, g, b]: Rgb): Rgb {
  return [
    1.2249401763 * r - 0.2249401763 * g,
    -0.0420569547 * r + 1.0420569547 * g,
    -0.0196375546 * r - 0.0786360456 * g + 1.0982736001 * b,
  ];
}

// ---------------------------------------------------------------------------
// Transfer function (shared by sRGB and Display P3)
// ---------------------------------------------------------------------------

/** sRGB transfer function (linear → gamma-encoded) */
export function encodeGamma(v: number): number {
  const abs = Math.abs(v);
  const out = abs <= 0.0031308 ? 12.92 * abs : 1.055 * abs ** (1 / 2.4) - 0.055;
  return Math.sign(v) * out;
}

/** sRGB transfer function (gamma-encoded → linear) */
export function decodeGamma(v: number): number {
  const abs = Math.abs(v);
  const out = abs <= 0.04045 ? abs / 12.92 : ((abs + 0.055) / 1.055) ** 2.4;
  return Math.sign(v) * out;
}

// ---------------------------------------------------------------------------
// Gamut checks and mapping
// ---------------------------------------------------------------------------

/** OKLab → linear RGB in the given gamut's primaries */
function oklabToLinearRgb(lab: Oklab, gamut: RgbGamut): Rgb {
  const srgb = oklabToLinearSrgb(lab);
  return gamut === "p3" ? linearSrgbToLinearP3(srgb) : srgb;
}

/** Linear RGB in the given gamut's primaries → OKLab */
function linearRgbToOklab(rgb: Rgb, gamut: RgbGamut): Oklab {
  return linearSrgbToOklab(gamut === "p3" ? linearP3ToLinearSrgb(rgb) : rgb);
}

/** Whether a linear RGB color lies inside its gamut, within `epsilon` */
function isLinearRgbInGamut(rgb: Rgb, epsilon = GAMUT_EPSILON): boolean {
  return rgb.every((v) => v >= -epsilon && v <= 1 + epsilon);
}

/** Whether an OKLCH color lies inside the given gamut (default: sRGB) */
export function isOklchInGamut(
  l: number,
  c: number,
  h: number,
  gamut: RgbGamut = "srgb",
  epsilon = GAMUT_EPSILON
): boolean {
  return isLinearRgbInGamut(oklabToLinearRgb(oklchToOklab(l, c, h), gamut), epsilon);
}

/**
 * Maximum OKLCH chroma reachable in the given gamut (default: sRGB)
 * for a given lightness and hue.
 *
 * Computed by bisection (the in-gamut region is convex along the chroma axis
 * for a fixed lightness and hue). Precision: ~1e-5, always on the inner side:
 * no tolerance is allowed, because near black even a tiny negative channel
 * is visible once clipped.
 */
export function maxChroma(l: number, h: number, gamut: RgbGamut = "srgb"): number {
  if (l <= 0 || l >= 1) return 0;
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (isOklchInGamut(l, mid, h, gamut, 0)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * OKLCH → OKLab of the color actually displayed on a screen of the given
 * gamut (default: sRGB), i.e. after per-channel clipping of the
 * gamma-encoded values (what browsers do today for out-of-gamut colors).
 */
export function oklchToDisplayedOklab(
  l: number,
  c: number,
  h: number,
  gamut: RgbGamut = "srgb"
): Oklab {
  const rgb = oklabToLinearRgb(oklchToOklab(l, c, h), gamut);
  const clipped = rgb.map((v) => decodeGamma(Math.min(1, Math.max(0, encodeGamma(v))))) as Rgb;
  return linearRgbToOklab(clipped, gamut);
}

/** Euclidean distance in OKLab (ΔE OK) */
export function deltaEOK(a: Oklab, b: Oklab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// ---------------------------------------------------------------------------
// Interpolation (JS equivalent of CSS `color-mix()`)
// ---------------------------------------------------------------------------

/**
 * Chroma at or below which browsers treat the hue of a color *converted* to
 * OKLCH (e.g. an `oklab()` or `color-mix(in oklab, …)` color mixed
 * `in oklch`) as missing. Measured in Chrome 156: exactly 0.02.
 * Colors written with relative syntax (`oklch(from … l c h)`) keep their hue.
 */
export const CONVERTED_HUE_CHROMA_THRESHOLD = 0.02;

/**
 * Interpolates in OKLCH, `t` being the weight of `b` (like
 * `color-mix(in oklch, a, b t%)`). Hue takes the shorter arc. A missing hue
 * (`NaN`) or the hue of an achromatic color is ignored: the other one is used.
 */
export function mixOklch([l1, c1, h1]: Oklch, [l2, c2, h2]: Oklch, t: number): Oklch {
  const missing1 = Number.isNaN(h1) || c1 < ACHROMATIC_EPSILON;
  const missing2 = Number.isNaN(h2) || c2 < ACHROMATIC_EPSILON;
  if (missing1 && missing2) h1 = h2 = 0;
  else if (missing1) h1 = h2;
  else if (missing2) h2 = h1;
  let dh = (((h2 - h1) % 360) + 360) % 360;
  if (dh > 180) dh -= 360;
  return [l1 + t * (l2 - l1), c1 + t * (c2 - c1), h1 + t * dh];
}

/** Interpolates in OKLab, `t` being the weight of `b`; returns OKLCH */
export function mixOklab(a: Oklch, b: Oklch, t: number): Oklch {
  const [L1, a1, b1] = oklchToOklab(...a);
  const [L2, a2, b2] = oklchToOklab(...b);
  return oklabToOklch([L1 + t * (L2 - L1), a1 + t * (a2 - a1), b1 + t * (b2 - b1)]);
}
