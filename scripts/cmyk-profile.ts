/**
 * Lecture des profils ICC CMJN avec jsColorEngine (devDependency), partagée
 * par `build-cmyk-gamuts.ts` et `diagnose-cmyk.ts`. Jamais importé par `src/`.
 */

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { linearSrgbToOklab, oklabToLinearSrgb, oklchToOklab, type Oklab } from "../src/oklab.ts";
import type { CmykGamut } from "../src/types.ts";

const require = createRequire(import.meta.url);
export const jsce = require("jscolorengine");
const { Profile, Transform, eIntent, color } = jsce;

/** Écart d'aller-retour (ΔE00) au-delà duquel une couleur n'est pas imprimable */
export const ROUND_TRIP_LIMIT = 2;

const ADOBE = "/Library/Application Support/Adobe/Color/Profiles/Recommended";
const ICC = new URL("../icc/", import.meta.url).pathname;
const REGISTRY = "https://registry.color.org/profile-registry/profiles";

/** Profil ICC source d'un gamut */
export interface CmykSource {
  /** Condition d'impression caractérisée (ex. « FOGRA39 ») */
  standard: string;
  path: string;
  /** Où le télécharger s'il manque */
  from: string;
}

/**
 * Chaque gamut CMJN couvre les deux générations de normes offset
 * (ISO 12647-2:2004 et :2013) : une couleur n'y entre que si elle est
 * imprimable avec **chacun** de ses profils, l'imprimeur pouvant travailler
 * avec l'un ou l'autre.
 *
 * - Profils Adobe (FOGRA39, FOGRA29) : installés avec la Creative Cloud.
 * - Profils ECI (FOGRA51, FOGRA52) : registre de l'ICC, à placer dans `icc/`
 *   (non versionné : leur licence permet l'usage, pas la redistribution).
 *
 * `--profile cmyk-coated=/a.icc,/b.icc` remplace les profils d'un gamut.
 */
export function cmykSources(argv = process.argv.slice(2)) {
  const sources: Record<CmykGamut, { label: string; profiles: CmykSource[] }> = {
    "cmyk-coated": {
      label: "Papier couché (offset)",
      profiles: [
        { standard: "FOGRA39", path: `${ADOBE}/CoatedFOGRA39.icc`, from: "Adobe Creative Cloud (CoatedFOGRA39.icc)" },
        { standard: "FOGRA51", path: `${ICC}PSOcoated_v3.icc`, from: `${REGISTRY}/PSOcoated_v3.icc` },
      ],
    },
    "cmyk-uncoated": {
      label: "Papier non couché (offset)",
      profiles: [
        { standard: "FOGRA29", path: `${ADOBE}/UncoatedFOGRA29.icc`, from: "Adobe Creative Cloud (UncoatedFOGRA29.icc)" },
        { standard: "FOGRA52", path: `${ICC}PSOuncoated_v3_FOGRA52.icc`, from: `${REGISTRY}/PSOuncoated_v3_FOGRA52.icc` },
      ],
    },
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--profile") continue;
    const [id, paths] = argv[++i].split("=");
    if (!(id in sources)) throw new Error(`Gamut inconnu : ${id} (attendus : ${Object.keys(sources).join(", ")})`);
    sources[id as CmykGamut].profiles = paths.split(",").map((path) => ({ standard: basename(path), path: resolve(path), from: path }));
  }
  for (const { profiles } of Object.values(sources))
    for (const { path, from } of profiles)
      if (!existsSync(path)) throw new Error(`Profil introuvable : ${path}\n  → ${from}`);
  return sources;
}

// ---------------------------------------------------------------------------
// OKLCH ↔ Lab D50 (sRGB linéaire ↔ XYZ D50 adapté Bradford, CSS Color 4)
// ---------------------------------------------------------------------------

export type Lab = [L: number, a: number, b: number];
const SRGB_TO_XYZ_D50 = [
  [0.436065742824811, 0.385151496323776, 0.143078560851413],
  [0.222493968339845, 0.716887060432932, 0.060618971227223],
  [0.013923904500943, 0.097081774653308, 0.714173431645835],
];
const XYZ_D50_TO_SRGB = [
  [3.1341359569958707, -1.6173863321612538, -0.4906619460083532],
  [-0.978795502912089, 1.916254567259524, 0.03344273116131949],
  [0.07195537988411677, -0.2289768264158322, 1.405386058324125],
];
const D50 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
const EPS = 216 / 24389;
const KAPPA = 24389 / 27;
const mul = (m: number[][], v: number[]) =>
  m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) as [number, number, number];

export function oklchToLab(l: number, c: number, h: number): Lab {
  const xyz = mul(SRGB_TO_XYZ_D50, oklabToLinearSrgb(oklchToOklab(l, c, h)));
  const [fx, fy, fz] = xyz.map((v, i) => {
    const t = v / D50[i];
    return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
  });
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToOklab([L, a, b]: Lab): Oklab {
  const fy = (L + 16) / 116;
  const xyz = [fy + a / 500, fy, fy - b / 200].map((f, i) => {
    const t = f ** 3 > EPS ? f ** 3 : (116 * f - 16) / KAPPA;
    return t * D50[i];
  });
  return linearSrgbToOklab(mul(XYZ_D50_TO_SRGB, xyz));
}

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------

/**
 * Charge un profil CMJN. `printed(lab)` : la couleur effectivement imprimée
 * après conversion Lab → CMJN → Lab en colorimétrie relative sans BPC (ce que
 * fait l'export d'une palette déjà dans le gamut).
 */
export async function loadCmykProfile(path: string) {
  const profile = new Profile();
  await profile.loadPromise("file:" + path);
  if (!profile.loaded) throw new Error(`${path} : ${profile.lastError}`);
  const toCmyk = new Transform({ BPC: false });
  toCmyk.create("*lab", profile, eIntent.relative);
  const toLab = new Transform({ BPC: false });
  toLab.create(profile, "*lab", eIntent.relative);

  const lab = (v: Lab) => color.Lab(v[0], v[1], v[2], undefined, false);
  const printed = (v: Lab): Lab => {
    const back = toLab.transform(toCmyk.transform(lab(v)));
    return [back.L, back.a, back.b];
  };
  const deltaE = (v: Lab) => color.deltaE2000(lab(v), lab(printed(v))) as number;
  return {
    description: String(profile.name || basename(path)),
    printed,
    /** ΔE00 entre la couleur et sa version imprimée */
    deltaE,
    printable: (v: Lab) => deltaE(v) < ROUND_TRIP_LIMIT,
  };
}
