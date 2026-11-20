// Shared helpers: OKLCH <-> Lab D50, jsColorEngine profile round-trip gamut test
import { createRequire } from "node:module";
import { oklchToOklab, oklabToLinearSrgb, linearSrgbToOklab } from "../../src/oklab.ts";
const require = createRequire(import.meta.url);
const SP = process.env.JSCE ?? "jscolorengine"; // chemin d’un clone ou nom du paquet npm
export const jsce = require(SP);
const { Profile, Transform, eIntent, color } = jsce;

export const PROFILES: Record<string, string> = {
  fogra39: "/Library/Application Support/Adobe/Color/Profiles/Recommended/CoatedFOGRA39.icc",
  fogra29: "/Library/Application Support/Adobe/Color/Profiles/Recommended/UncoatedFOGRA29.icc",
  gracol: "/Library/Application Support/Adobe/Color/Profiles/Recommended/CoatedGRACoL2006.icc",
};

// linear sRGB -> XYZ D65 -> Bradford D50 -> Lab D50
const M = [ // linear sRGB -> XYZ D50 (Bradford-adapted, from CSS Color 4)
  [0.436065742824811, 0.385151496323776, 0.143078560851413],
  [0.222493968339845, 0.716887060432932, 0.060618971227223],
  [0.013923904500943, 0.097081774653308, 0.714173431645835],
];
const Minv = [
  [3.1341359569958707, -1.6173863321612538, -0.4906619460083532],
  [-0.978795502912089, 1.916254567259524, 0.03344273116131949],
  [0.07195537988411677, -0.2289768264158322, 1.405386058324125],
];
const D50 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const finv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
export function oklchToLab(l: number, c: number, h: number): [number, number, number] {
  const rgb = oklabToLinearSrgb(oklchToOklab(l, c, h));
  const xyz = M.map((r) => r[0] * rgb[0] + r[1] * rgb[1] + r[2] * rgb[2]);
  const [fx, fy, fz] = xyz.map((v, i) => f(v / D50[i]));
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function labToOklab(L: number, a: number, b: number) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const xyz = [finv(fx) * D50[0], finv(fy) * D50[1], finv(fz) * D50[2]];
  const rgb = Minv.map((r) => r[0] * xyz[0] + r[1] * xyz[1] + r[2] * xyz[2]) as [number, number, number];
  return linearSrgbToOklab(rgb);
}

export async function loadCmyk(name: string, intent = eIntent.relative, BPC = false) {
  const p = new Profile();
  await p.loadPromise("file:" + PROFILES[name]);
  if (!p.loaded) throw new Error(p.lastError);
  const lab2cmyk = new Transform({ BPC });
  lab2cmyk.create("*lab", p, intent);
  const cmyk2lab = new Transform({ BPC });
  cmyk2lab.create(p, "*lab", intent);
  return {
    profile: p,
    toCmyk: (lab: number[]) => lab2cmyk.transform(color.Lab(lab[0], lab[1], lab[2], undefined, false)),
    toLab: (c: any) => { const r = cmyk2lab.transform(c); return [r.L, r.a, r.b]; },
  };
}
export type Cmyk = Awaited<ReturnType<typeof loadCmyk>>;
export const dE00 = (a: number[], b: number[]) =>
  color.deltaE2000(color.Lab(a[0], a[1], a[2], undefined, false), color.Lab(b[0], b[1], b[2], undefined, false));

/** Round-trip error Lab -> CMYK -> Lab (ΔE2000) */
export function roundTrip(cm: Cmyk, lab: number[]) {
  const c = cm.toCmyk(lab);
  return { cmyk: c, dE: dE00(lab, cm.toLab(c)) };
}
