/**
 * Diagnostic des palettes catégorielles d'ok-palette.
 *
 * Pour chaque préréglage (`presets`) combiné à chaque filtre de température
 * (`temperature`), et pour 2 à 16 classes, le script mesure :
 *
 * - le nombre de couleurs hors du gamut sRGB (le navigateur les écrête,
 *   la luminosité et la chroma affichées ne sont donc plus celles visées) ;
 * - le ΔE OK minimal entre deux couleurs de la palette, calculé sur les couleurs
 *   réellement affichées (écrêtage par canal sRGB, comme le font les navigateurs).
 *
 * Repères : ΔE OK < 0,02 ≈ couleurs indiscernables ; < 0,05 ≈ risque de confusion
 * sur une carte (petites surfaces, voisinage).
 *
 * Usage (Node ≥ 22.18, sans dépendance) :
 *
 *   node scripts/diagnose-categorical.ts                 # tableaux 2 → 16 classes
 *   node scripts/diagnose-categorical.ts --max 24        # jusqu'à 24 classes
 *   node scripts/diagnose-categorical.ts --detail sepia  # couleurs d'un préréglage (8 classes)
 *   node scripts/diagnose-categorical.ts --detail vif,chaude,12
 *   node scripts/diagnose-categorical.ts --json          # sortie JSON
 *
 * Le script importe directement les sources TypeScript de `src/` : il mesure
 * donc toujours le code de la copie de travail.
 */

import { registerHooks } from "node:module";

// Les sources importent leurs modules sans extension ("./utils") : on ajoute
// ".ts" à la résolution pour que Node puisse les charger directement.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context);
      } catch {
        // on retombe sur la résolution par défaut
      }
    }
    return nextResolve(specifier, context);
  },
});

const { categorical } = await import("../src/categorical.ts");
const { presets, temperature } = await import("../src/presets.ts");
const { isOklchInGamut, maxChroma, oklchToDisplayedOklab, deltaEOK } = await import(
  "../src/oklab.ts"
);

type Options = Parameters<typeof categorical>[1];

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const argValue = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const minCount = Number(argValue("--min") ?? 2);
const maxCount = Number(argValue("--max") ?? 16);
const asJson = args.includes("--json");
const detail = argValue("--detail");

// ---------------------------------------------------------------------------
// Mesures
// ---------------------------------------------------------------------------

interface ParsedColor {
  css: string;
  l: number;
  c: number;
  h: number;
}

/** Lit une couleur `oklch(L% C H)` produite par `categorical()` */
function parseOklch(css: string): ParsedColor {
  const match = css.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!match) throw new Error(`Couleur inattendue : ${css}`);
  return { css, l: Number(match[1]) / 100, c: Number(match[2]), h: Number(match[3]) };
}

interface PaletteReport {
  count: number;
  outOfGamut: number[];
  minDeltaE: number;
  closestPair: [number, number];
}

function measure(palette: string[]): PaletteReport {
  const colors = palette.map(parseOklch);
  const displayed = colors.map(({ l, c, h }) => oklchToDisplayedOklab(l, c, h));
  const outOfGamut = colors.flatMap(({ l, c, h }, i) => (isOklchInGamut(l, c, h) ? [] : [i]));

  let minDeltaE = Infinity;
  let closestPair: [number, number] = [0, 0];
  for (let i = 0; i < displayed.length; i++) {
    for (let j = i + 1; j < displayed.length; j++) {
      const d = deltaEOK(displayed[i], displayed[j]);
      if (d < minDeltaE) {
        minDeltaE = d;
        closestPair = [i, j];
      }
    }
  }
  return { count: palette.length, outOfGamut, minDeltaE, closestPair };
}

// ---------------------------------------------------------------------------
// Configurations testées
// ---------------------------------------------------------------------------

const presetEntries: [string, Options][] = [
  ["(défaut)", {}],
  ...Object.entries(presets).map(([name, p]) => [name, p] as [string, Options]),
];
const temperatureEntries: [string, Options][] = [
  ["—", {}],
  ...Object.entries(temperature).map(([name, t]) => [name, t] as [string, Options]),
];

interface Config {
  preset: string;
  temperature: string;
  options: Options;
}

const configs: Config[] = [];
const seen = new Set<string>();
for (const [presetName, presetOptions] of presetEntries) {
  for (const [tempName, tempOptions] of temperatureEntries) {
    const options = { ...presetOptions, ...tempOptions };
    const key = JSON.stringify(categorical(maxCount, options));
    if (seen.has(key)) continue; // ex. vif + mixte = vif seul
    seen.add(key);
    configs.push({ preset: presetName, temperature: tempName, options });
  }
}

// ---------------------------------------------------------------------------
// Sorties
// ---------------------------------------------------------------------------

const fmt = (x: number, digits = 3) => x.toFixed(digits).replace(/^0/, "");

function printDetail(spec: string) {
  const [presetName, tempName = "—", countArg = "8"] = spec.split(",");
  const presetOptions = presetEntries.find(([n]) => n === presetName)?.[1];
  const tempOptions = temperatureEntries.find(([n]) => n === tempName)?.[1];
  if (!presetOptions || !tempOptions) {
    throw new Error(`Préréglage ou température inconnus : ${spec}`);
  }
  const palette = categorical(Number(countArg), { ...presetOptions, ...tempOptions });
  const report = measure(palette);

  console.log(`\n${presetName} + ${tempName}, ${countArg} classes`);
  console.log("  #  couleur                          Cmax    gamut  ΔE au plus proche");
  const displayed = palette.map(parseOklch).map(({ l, c, h }) => oklchToDisplayedOklab(l, c, h));
  palette.map(parseOklch).forEach(({ css, l, h }, i) => {
    let nearest = Infinity;
    let nearestIndex = -1;
    displayed.forEach((other, j) => {
      const d = j === i ? Infinity : deltaEOK(displayed[i], other);
      if (d < nearest) [nearest, nearestIndex] = [d, j];
    });
    const gamut = report.outOfGamut.includes(i) ? "HORS" : "ok";
    console.log(
      `  ${String(i).padStart(2)} ${css.padEnd(32)} ${fmt(maxChroma(l, h)).padEnd(7)} ${gamut.padEnd(6)} ${fmt(nearest)} (#${nearestIndex})`
    );
  });
  console.log(
    `  ΔE min ${fmt(report.minDeltaE)} entre #${report.closestPair[0]} et #${report.closestPair[1]}`
  );
}

function printTables() {
  const counts = Array.from({ length: maxCount - minCount + 1 }, (_, k) => minCount + k);
  const label = (c: Config) => `${c.preset} + ${c.temperature}`.padEnd(22);
  const header = `${"".padEnd(22)} ${counts.map((n) => String(n).padStart(4)).join(" ")}`;

  const rows = configs.map((config) => ({
    config,
    reports: counts.map((n) => measure(categorical(n, config.options))),
  }));

  console.log("\nΔE OK minimal entre deux couleurs (couleurs affichées, après écrêtage sRGB)");
  console.log("  ! < .050 (risque de confusion)   !! < .020 (indiscernables)\n");
  console.log(header);
  for (const { config, reports } of rows) {
    const cells = reports.map(({ minDeltaE }) => {
      const flag = minDeltaE < 0.02 ? "!!" : minDeltaE < 0.05 ? "!" : "";
      return (flag + fmt(minDeltaE, 2).slice(0, 3)).padStart(4);
    });
    console.log(`${label(config)} ${cells.join(" ")}`);
  }

  console.log("\nNombre de couleurs hors du gamut sRGB\n");
  console.log(header);
  for (const { config, reports } of rows) {
    const cells = reports.map(({ outOfGamut }) => String(outOfGamut.length || "·").padStart(4));
    console.log(`${label(config)} ${cells.join(" ")}`);
  }

  console.log("\nSynthèse (pire cas sur l'ensemble des effectifs testés)\n");
  console.log(`${"".padEnd(22)}  ΔE min  (effectif)  hors gamut à ${maxCount} classes`);
  for (const { config, reports } of rows) {
    const worst = reports.reduce((a, b) => (b.minDeltaE < a.minDeltaE ? b : a));
    const last = reports[reports.length - 1];
    console.log(
      `${label(config)}  ${fmt(worst.minDeltaE).padEnd(6)}  (${String(worst.count).padStart(2)})        ${last.outOfGamut.length}/${last.count}`
    );
  }
}

if (asJson) {
  const counts = Array.from({ length: maxCount - minCount + 1 }, (_, k) => minCount + k);
  const out = configs.map(({ preset, temperature, options }) => ({
    preset,
    temperature,
    options,
    palettes: counts.map((n) => {
      const palette = categorical(n, options);
      const { outOfGamut, minDeltaE, closestPair } = measure(palette);
      return { count: n, palette, outOfGamut, minDeltaE, closestPair };
    }),
  }));
  console.log(JSON.stringify(out, null, 2));
} else if (detail) {
  printDetail(detail);
} else {
  printTables();
}
