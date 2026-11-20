/**
 * Diagnostic des gamuts CMJN d'ok-palette (`gamut: "cmyk-coated" | "cmyk-uncoated"`).
 *
 * Chaque classe est « imprimée » par jsColorEngine avec le profil ICC
 * correspondant (Lab → CMJN → Lab, colorimétrie relative sans BPC, ce que fait
 * l'export d'une palette déjà dans le gamut) puis comparée à la couleur
 * calculée. Deux contrôles :
 *
 * 1. **Table** : sur des (L, H) tirés au hasard dans la plage imprimable, la
 *    chroma maximale de `gamutMaxChroma` s'imprime-t-elle à moins de ΔE00 2 ?
 * 2. **Palettes** : séquentielles, divergentes et catégorielles, générées en
 *    `gamut: "srgb"` (comportement actuel) puis avec le gamut CMJN :
 *    - classes non imprimables (aller-retour ≥ ΔE00 2) et écart maximal ;
 *    - classes confondues par l'impression : distinctes à l'écran mais à
 *      moins de ΔE OK 0,02 une fois imprimées, entre classes voisines
 *      (séquentiel, divergent) ou entre deux classes quelconques (catégoriel) ;
 *    - classes hors sRGB (doit rester à 0 : la palette s'affiche aussi à l'écran).
 * 3. **Export** : écart à l'impression des palettes CMJN converties depuis
 *    le sRGB (comme le fait Illustrator sur un SVG) selon l'intention de
 *    rendu : relative, relative + compensation du point noir, perceptive.
 *
 * Usage (Node ≥ 22.18, profils Adobe par défaut, voir `cmyk-profile.ts`) :
 *
 *   node scripts/diagnose-cmyk.ts
 *   node scripts/diagnose-cmyk.ts --profile cmyk-coated=/chemin/ISOcoated_v2_eci.icc
 *
 * Chaque gamut est contrôlé avec chacun des profils dont il est l'intersection.
 */

import "./register-ts.ts";
import type { CmykGamut, ContrastMode, Gamut } from "../src/types.ts";

const { cmykSources, jsce, labToOklab, loadCmykProfile, oklchToLab, ROUND_TRIP_LIMIT } = await import(
  "./cmyk-profile.ts"
);
const { sequential } = await import("../src/sequential.ts");
const { divergent, divergentSequential } = await import("../src/divergent.ts");
const { categorical } = await import("../src/categorical.ts");
const { presets, temperature } = await import("../src/presets.ts");
const { parseCssColor } = await import("../src/parse.ts");
const { deltaEOK, encodeGamma, isOklchInGamut, oklabToLinearSrgb, oklabToOklch, oklchToOklab } =
  await import("../src/oklab.ts");
const { gamutLightnessRange, gamutMaxChroma } = await import("../src/gamut.ts");

type Oklch = [number, number, number];
const COLLAPSE = 0.02;

const SEQUENTIAL_COLORS = ["steelblue", "#2b83ba", "#3b4cc0", "#d7191c", "#e66101", "#008837", "#7b3294", "gold", "red", "lime", "blue"];
const PAIRS: [string, string | undefined][] = [
  ["#d7191c", "#2b83ba"],
  ["#e66101", "#5e3c99"],
  ["#7b3294", "#008837"],
  ["#f4e285", "#1d3557"],
  ["red", "blue"],
  ["#3b4cc0", undefined],
];
const CONTRASTS: ContrastMode[] = ["low", "normal", "high"];

interface Case {
  family: "séquentiel" | "divergent" | "catégoriel";
  pairwise: boolean;
  generate: (gamut: Gamut) => string[];
}

const cases: Case[] = [];
for (const color of SEQUENTIAL_COLORS)
  for (const steps of [3, 5, 7, 9])
    for (const contrast of CONTRASTS)
      cases.push({ family: "séquentiel", pairwise: false, generate: (gamut) => sequential({ colorStart: color, steps, contrast, gamut }) });
for (const [colorStart, colorEnd] of PAIRS.filter(([, b]) => b))
  for (const steps of [5, 7, 9])
    cases.push({ family: "séquentiel", pairwise: false, generate: (gamut) => sequential({ colorStart, colorEnd, steps, gamut }) });
for (const [colorA, colorB] of PAIRS)
  for (const steps of [[3, 3], [5, 5], [4, 2]] as [number, number][])
    for (const contrast of CONTRASTS) {
      cases.push({ family: "divergent", pairwise: false, generate: (gamut) => divergent({ colorA, colorB, steps, contrast, hasCenterClass: true, gamut }) });
      cases.push({ family: "divergent", pairwise: false, generate: (gamut) => divergentSequential({ colorA, colorB, steps, contrast, gamut }) });
    }
for (const preset of Object.values(presets))
  for (const temp of Object.values(temperature))
    for (const count of [4, 8, 12])
      cases.push({ family: "catégoriel", pairwise: true, generate: (gamut) => categorical(count, { ...preset, ...temp, gamut }) });

const read = (css: string): Oklch => oklabToOklch(parseCssColor(css)!) as Oklch;
const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(0)} %`.padStart(5);

for (const [id, { label, profiles }] of Object.entries(cmykSources()))
for (const { standard, path } of profiles) {
  const gamut = id as CmykGamut;
  const cmyk = await loadCmykProfile(path);
  console.log(`\n=== ${id} — ${label} — imprimé en ${standard} (${cmyk.description})`);

  // 1. Table
  const [minL] = gamutLightnessRange(gamut);
  let seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const errors: number[] = [];
  for (let k = 0; k < 20000; k++) {
    const l = minL + rnd() * (0.995 - minL);
    const h = rnd() * 360;
    errors.push(cmyk.deltaE(oklchToLab(l, gamutMaxChroma(l, h, gamut), h)));
  }
  errors.sort((a, b) => a - b);
  const over = errors.filter((e) => e >= ROUND_TRIP_LIMIT).length;
  console.log(
    `Table (20 000 points sur la frontière, L ≥ ${minL}) : ΔE00 médian ${errors[10000].toFixed(2)}, ` +
      `p99 ${errors[19800].toFixed(2)}, max ${errors[19999].toFixed(2)} ; ≥ ${ROUND_TRIP_LIMIT} : ${over} (${pct(over, errors.length).trim()})`
  );

  // 2. Palettes
  console.log(`\nfamille     | gamut         | palettes | classes | non imprimables | ΔE00 max | confondues par l'impression | hors sRGB`);
  for (const family of ["séquentiel", "divergent", "catégoriel"] as const) {
    for (const g of ["srgb", gamut] as Gamut[]) {
      let classes = 0, unprintable = 0, maxDE = 0, collapsed = 0, outsideSrgb = 0, palettes = 0;
      for (const c of cases.filter((c) => c.family === family)) {
        const palette = c.generate(g).map(read);
        palettes++;
        classes += palette.length;
        const printed = palette.map(([l, ch, h]) => {
          const lab = oklchToLab(l, ch, h);
          const dE = cmyk.deltaE(lab);
          if (dE >= ROUND_TRIP_LIMIT) unprintable++;
          maxDE = Math.max(maxDE, dE);
          if (!isOklchInGamut(l, ch, h, "srgb")) outsideSrgb++;
          return labToOklab(cmyk.printed(lab));
        });
        const screen = palette.map(([l, ch, h]) => oklchToOklab(l, ch, h));
        const close = (i: number, j: number) =>
          deltaEOK(printed[i], printed[j]) < COLLAPSE && deltaEOK(screen[i], screen[j]) >= COLLAPSE;
        if (c.pairwise) {
          for (let i = 0; i < printed.length; i++) for (let j = i + 1; j < printed.length; j++) if (close(i, j)) collapsed++;
        } else {
          for (let i = 1; i < printed.length; i++) if (close(i - 1, i)) collapsed++;
        }
      }
      console.log(
        `${family.padEnd(11)} | ${g.padEnd(13)} | ${String(palettes).padStart(8)} | ${String(classes).padStart(7)} | ` +
          `${String(unprintable).padStart(6)} (${pct(unprintable, classes)}) | ${maxDE.toFixed(1).padStart(8)} | ` +
          `${String(collapsed).padStart(27)} | ${String(outsideSrgb).padStart(9)}`
      );
    }
  }

  // 3. Export depuis le sRGB
  const { Profile, Transform, eIntent, color } = jsce;
  const profile = new Profile();
  await profile.loadPromise("file:" + path);
  const toLab = new Transform({ BPC: false });
  toLab.create(profile, "*lab", eIntent.relative);
  const classes = cases
    .filter((c) => c.family !== "divergent")
    .flatMap((c) => c.generate(gamut).map(read));
  console.log(`\nExport depuis le sRGB (${classes.length} classes séquentielles et catégorielles) :`);
  for (const [name, intent, BPC] of [
    ["relative", eIntent.relative, false],
    ["relative + BPC", eIntent.relative, true],
    ["perceptive", eIntent.perceptual, true],
  ] as const) {
    const fromSrgb = new Transform({ BPC });
    fromSrgb.create("*srgb", profile, intent);
    const errors = classes
      .map(([l, ch, h]) => {
        const rgb = oklabToLinearSrgb(oklchToOklab(l, ch, h)).map((v) => Math.min(1, Math.max(0, encodeGamma(v))) * 255);
        const printed = toLab.transform(fromSrgb.transform(color.RGB(rgb[0], rgb[1], rgb[2], false)));
        const lab = oklchToLab(l, ch, h);
        return color.deltaE2000(color.Lab(lab[0], lab[1], lab[2], undefined, false), printed) as number;
      })
      .sort((a, b) => a - b);
    const q = (p: number) => errors[Math.floor(p * (errors.length - 1))].toFixed(1);
    console.log(`  ${name.padEnd(15)} ΔE00 médian ${q(0.5)}, p95 ${q(0.95)}, max ${q(1)}`);
  }
}
