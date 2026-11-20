/**
 * Génère les tables sRGB → CMJN du générateur web d'ok-palette (export des
 * valeurs CMJN), une par profil d'impression : `<out>/<id>.json`.
 *
 * Ces tables ne font pas partie de la bibliothèque : elles servent au site,
 * dont le module `src/lib/data/ok-palette/cmyk.js` les interpole. Elles sont
 * calculées ici parce que l'outillage ICC (jsColorEngine, profils) y est.
 *
 * Conversion : sRGB → CMJN en colorimétrie relative, sans compensation du
 * point noir (une palette `cmyk-*` est déjà imprimable : rien à compresser),
 * pipeline f64 de jsColorEngine à chaque point d'une grille `GRID`³.
 * Encres sur un octet (0–255 pour 0–100 %), codées en différences le long de
 * l'axe bleu (modulo 256) puis en base64.
 *
 * Usage (Node ≥ 22.18) :
 *
 *   node scripts/build-cmyk-luts.ts --out ../web-atelier/static/ok-palette/cmyk \
 *     [--check ../web-atelier/src/lib/data/ok-palette/cmyk.js]
 *
 * `--check` mesure, sur les palettes `cmyk-*` du jeu d'essai, l'écart entre
 * les encres interpolées par le module du site (arrondies au %) et celles du
 * pipeline f64, et l'écart de couleur imprimée qui en résulte.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import "./register-ts.ts";
import type { CmykGamut } from "../src/types.ts";

const { cmykSources, jsce } = await import("./cmyk-profile.ts");
const { sequential } = await import("../src/sequential.ts");
const { divergent } = await import("../src/divergent.ts");
const { categorical } = await import("../src/categorical.ts");
const { presets } = await import("../src/presets.ts");
const { parseCssColor } = await import("../src/parse.ts");
const { encodeGamma, oklabToLinearSrgb } = await import("../src/oklab.ts");
const { Profile, Transform, eIntent, color } = jsce;

/** Points par axe de la grille sRGB */
const GRID = 33;

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const outDir = option("--out");
if (!outDir) throw new Error("--out <dossier> manquant");
const check = option("--check");

type Cmyk = [number, number, number, number];
type Lut = { id: string; standard: string; profile: string; grid: number; cmyk: string };

const rgbOf = (css: string) =>
  oklabToLinearSrgb(parseCssColor(css)!).map((v) => Math.min(1, Math.max(0, encodeGamma(v)))) as [
    number,
    number,
    number,
  ];

/** Palettes `cmyk-*` du jeu d'essai, en sRGB 0–1 */
function testColors(gamut: CmykGamut) {
  const css = [
    ...["steelblue", "#2b83ba", "#d7191c", "#e66101", "#008837", "#7b3294", "gold", "red", "lime", "blue"].flatMap((c) =>
      [3, 5, 7, 9].flatMap((steps) =>
        (["low", "normal", "high"] as const).map((contrast) => sequential({ colorStart: c, steps, contrast, gamut }))
      )
    ),
    ...[["#d7191c", "#2b83ba"], ["#e66101", "#5e3c99"], ["#7b3294", "#008837"]].map(([colorA, colorB]) =>
      divergent({ colorA, colorB, steps: [5, 5], hasCenterClass: true, gamut })
    ),
    ...Object.values(presets).map((p) => categorical(12, { ...p, gamut })),
  ].flat();
  return css.map(rgbOf);
}

const site = check ? await import(resolve(check)) : null;
mkdirSync(outDir, { recursive: true });

for (const [gamut, { profiles }] of Object.entries(cmykSources())) {
  for (const { standard, path } of profiles) {
    const id = standard.toLowerCase();
    const profile = new Profile();
    await profile.loadPromise("file:" + path);
    if (!profile.loaded) throw new Error(`${path} : ${profile.lastError}`);
    const toCmyk = new Transform({ BPC: false, dataFormat: "objectFloat" });
    toCmyk.create("*srgb", profile, eIntent.relative);
    const exact = (rgb: number[]): Cmyk => {
      const c = toCmyk.transform(color.RGBf(rgb[0], rgb[1], rgb[2]));
      return [c.Cf, c.Mf, c.Yf, c.Kf].map((v: number) => v * 100) as Cmyk;
    };

    // Grille, index ((r × GRID + g) × GRID + b) × 4
    const bytes = new Uint8Array(GRID ** 3 * 4);
    for (let r = 0; r < GRID; r++)
      for (let g = 0; g < GRID; g++)
        for (let b = 0; b < GRID; b++) {
          const ink = exact([r / (GRID - 1), g / (GRID - 1), b / (GRID - 1)]);
          const k = ((r * GRID + g) * GRID + b) * 4;
          ink.forEach((v, ch) => (bytes[k + ch] = Math.round((Math.min(100, Math.max(0, v)) / 100) * 255)));
        }
    const row = GRID * 4;
    const delta = bytes.map((v, k) => (k % row >= 4 ? (v - bytes[k - 4]) & 255 : v));

    const lut: Lut = {
      id,
      standard,
      profile: String(profile.name),
      grid: GRID,
      cmyk: Buffer.from(delta).toString("base64"),
    };
    const json = JSON.stringify(lut);
    writeFileSync(resolve(outDir, `${id}.json`), json + "\n");
    console.log(
      `${id} (${lut.profile}) : ${(json.length / 1024).toFixed(0)} Ko, ${(gzipSync(json).length / 1024).toFixed(0)} Ko gzip`
    );

    if (!site) continue;
    const toLab = new Transform({ BPC: false, dataFormat: "objectFloat" });
    toLab.create(profile, "*lab", eIntent.relative);
    const lab = (c: Cmyk) => toLab.transform(color.CMYKf(...c.map((v) => v / 100)));
    const decoded = site.decodeCmykLut(lut);
    let inkMax = 0;
    let deMax = 0;
    let roundMax = 0;
    const colors = testColors(gamut as CmykGamut);
    for (const rgb of colors) {
      const ref = exact(rgb);
      const got = site.roundCmyk(site.rgbToCmyk(decoded, rgb)) as Cmyk;
      inkMax = Math.max(inkMax, ...ref.map((v, ch) => Math.abs(v - got[ch])));
      deMax = Math.max(deMax, color.deltaE2000(lab(ref), lab(got)));
      roundMax = Math.max(roundMax, color.deltaE2000(lab(ref), lab(ref.map(Math.round) as Cmyk)));
    }
    console.log(
      `  contrôle sur ${colors.length} classes ${gamut} : écart d'encre max ${inkMax.toFixed(1)} %, ` +
        `couleur imprimée ΔE00 max ${deMax.toFixed(2)} (arrondi seul du f64 : ${roundMax.toFixed(2)})`
    );
  }
}
