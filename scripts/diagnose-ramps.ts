/**
 * Diagnostic des palettes séquentielles et divergentes d'ok-palette
 * (`sequential`, `divergent`, `divergentSequential`).
 *
 * Pour un jeu de couleurs d'entrée courantes (ColorBrewer, couleurs pures sRGB
 * et Display P3), plusieurs nombres de classes et profils de contraste, le
 * script compare trois réglages de l'option `gamut` :
 *
 * - `none` : CSS pur (`color-mix()`, couleurs relatives), le comportement
 *   historique. Les couleurs sont calculées par un modèle JS du CSS, vérifié
 *   contre Chrome (ΔE OK ≤ 0,003 sur 37 000 classes) ;
 * - `srgb` (défaut) et `p3` : sortie réelle de la fonction (`oklch()` bornés).
 *
 * Mesures, pour un écran sRGB et pour un écran Display P3 :
 *
 * - classes hors gamut de l'écran (le navigateur les écrête) ;
 * - écart d'affichage : ΔE OK entre la couleur calculée et la couleur affichée
 *   après écrêtage par canal (maximum et moyenne) ;
 * - paires de classes voisines qui se confondent à l'affichage (ΔE OK < 0,02)
 *   et palettes dont la luminosité affichée n'est plus monotone.
 *
 * Usage (Node ≥ 22.18, sans dépendance) :
 *
 *   node scripts/diagnose-ramps.ts                     # tableaux de synthèse
 *   node scripts/diagnose-ramps.ts --detail sequential "oklch(52.4% 0.158 252.3)" 5
 *   node scripts/diagnose-ramps.ts --detail divergent "#d7191c" "#2b83ba" 3
 *   node scripts/diagnose-ramps.ts --json
 */

import "./register-ts.ts";

const { sequential, sequentialOklch } = await import("../src/sequential.ts");
const { divergent, divergentOklch, divergentSequential, divergentSequentialOklch } = await import(
  "../src/divergent.ts"
);
const { parseCssColor } = await import("../src/parse.ts");
const { deltaEOK, isOklchInGamut, oklabToOklch, oklchToDisplayedOklab, oklchToOklab } =
  await import("../src/oklab.ts");

type Oklch = [number, number, number];
type Mode = "none" | "srgb" | "p3";
type Screen = "srgb" | "p3";
type Contrast = "low" | "normal" | "high";

const MODES: Mode[] = ["none", "srgb", "p3"];
const SCREENS: Screen[] = ["srgb", "p3"];
const CONTRASTS: Contrast[] = ["low", "normal", "high"];

// ---------------------------------------------------------------------------
// Jeu d'essai
// ---------------------------------------------------------------------------

/** Couleurs d'entrée des palettes séquentielles */
const SEQUENTIAL_COLORS = [
  "oklch(52.4% 0.158 252.3)", // cas relevé depuis le générateur du site
  "steelblue",
  "#2b83ba",
  "#3b4cc0",
  "#d7191c",
  "#e66101",
  "#008837",
  "#7b3294",
  "gold",
  "red",
  "lime",
  "blue",
  "color(display-p3 0 0.8 0.3)",
  "color(display-p3 1 0.2 0.6)",
];

/** Couples de couleurs (séquentiel bi-ton et divergent) ; B absente = complémentaire */
const PAIRS: [string, string | undefined][] = [
  ["#d7191c", "#2b83ba"],
  ["#e66101", "#5e3c99"],
  ["#7b3294", "#008837"],
  ["#f4e285", "#1d3557"],
  ["red", "blue"],
  ["oklch(52.4% 0.158 252.3)", undefined],
  ["#3b4cc0", undefined],
  ["color(display-p3 1 0.2 0.1)", "color(display-p3 0 0.5 1)"],
];

const SEQUENTIAL_STEPS = [3, 5, 7, 9];
const DIVERGENT_STEPS: [number, number][] = [
  [3, 3],
  [5, 5],
  [4, 2],
];

const read = (css: string): Oklch => {
  const lab = parseCssColor(css);
  if (!lab) throw new Error(`Couleur illisible : ${css}`);
  return oklabToOklch(lab) as Oklch;
};
const complement = ([l, c, h]: Oklch): Oklch => [l, c, (h + 180) % 360];

/** Lit une sortie `oklch(L% C H)` des fonctions en mode srgb / p3 */
const readOutput = (css: string): Oklch => read(css);

interface Case {
  family: "sequential" | "divergent" | "divergentSequential";
  label: string;
  /** Palette (OKLCH) pour chaque mode */
  palettes: Record<Mode, Oklch[]>;
}

function buildCases(): Case[] {
  const cases: Case[] = [];

  for (const color of SEQUENTIAL_COLORS) {
    for (const steps of SEQUENTIAL_STEPS) {
      for (const contrast of CONTRASTS) {
        const c = read(color);
        cases.push({
          family: "sequential",
          label: `${color} · ${steps} · ${contrast}`,
          palettes: {
            none: sequentialOklch(c, c, steps, contrast),
            srgb: sequential({ colorStart: color, steps, contrast, gamut: "srgb" }).map(readOutput),
            p3: sequential({ colorStart: color, steps, contrast, gamut: "p3" }).map(readOutput),
          },
        });
      }
    }
  }

  for (const [a, b] of PAIRS) {
    const A = read(a);
    const B = b ? read(b) : complement(A);

    if (b) {
      for (const steps of [5, 7]) {
        cases.push({
          family: "sequential",
          label: `${a} → ${b} · ${steps}`,
          palettes: {
            none: sequentialOklch(A, B, steps, "normal"),
            srgb: sequential({ colorStart: a, colorEnd: b, steps, gamut: "srgb" }).map(readOutput),
            p3: sequential({ colorStart: a, colorEnd: b, steps, gamut: "p3" }).map(readOutput),
          },
        });
      }
    }

    for (const steps of DIVERGENT_STEPS) {
      for (const contrast of CONTRASTS) {
        for (const hasCenterClass of [true, false]) {
          for (const colorSpace of ["oklab", "oklch"] as const) {
            const options = { colorA: a, colorB: b, steps, contrast, hasCenterClass, colorSpace };
            cases.push({
              family: "divergent",
              label: `${a} / ${b ?? "compl."} · ${steps} · ${contrast} · ${colorSpace}${hasCenterClass ? " · centre" : ""}`,
              palettes: {
                none: divergentOklch(A, B, steps, contrast, hasCenterClass, colorSpace),
                srgb: divergent({ ...options, gamut: "srgb" }).map(readOutput),
                p3: divergent({ ...options, gamut: "p3" }).map(readOutput),
              },
            });
          }
          const options = { colorA: a, colorB: b, steps, contrast, hasCenterClass };
          cases.push({
            family: "divergentSequential",
            label: `${a} / ${b ?? "compl."} · ${steps} · ${contrast}${hasCenterClass ? " · centre" : ""}`,
            palettes: {
              none: divergentSequentialOklch(A, B, steps, contrast, hasCenterClass),
              srgb: divergentSequential({ ...options, gamut: "srgb" }).map(readOutput),
              p3: divergentSequential({ ...options, gamut: "p3" }).map(readOutput),
            },
          });
        }
      }
    }
  }

  return cases;
}

// ---------------------------------------------------------------------------
// Mesures
// ---------------------------------------------------------------------------

interface Measure {
  classes: number;
  outOfGamut: number;
  palettesOutOfGamut: number;
  maxShift: number;
  sumShift: number;
  confusedPairs: number;
  nonMonotonic: number;
  palettes: number;
}

const emptyMeasure = (): Measure => ({
  classes: 0,
  outOfGamut: 0,
  palettesOutOfGamut: 0,
  maxShift: 0,
  sumShift: 0,
  confusedPairs: 0,
  nonMonotonic: 0,
  palettes: 0,
});

/** Luminosité monotone (séquentiel) ou en V (divergent : descend puis monte) */
function isLightnessOrdered(ls: number[], family: Case["family"]): boolean {
  const eps = 1e-3;
  if (family === "sequential") {
    const down = ls.every((l, i) => i === 0 || l < ls[i - 1] + eps);
    const up = ls.every((l, i) => i === 0 || l > ls[i - 1] - eps);
    return down || up;
  }
  // divergent: dark → light → dark
  const peak = ls.indexOf(Math.max(...ls));
  return ls.every((l, i) => i === 0 || (i <= peak ? l > ls[i - 1] - eps : l < ls[i - 1] + eps));
}

function measure(palette: Oklch[], family: Case["family"], screen: Screen, into: Measure) {
  const displayed = palette.map(([l, c, h]) => oklchToDisplayedOklab(l, c, h, screen));
  const outside = palette.filter(([l, c, h]) => !isOklchInGamut(l, c, h, screen)).length;

  into.palettes++;
  into.classes += palette.length;
  into.outOfGamut += outside;
  if (outside) into.palettesOutOfGamut++;

  palette.forEach(([l, c, h], i) => {
    const shift = deltaEOK(oklchToOklab(l, c, h), displayed[i]);
    into.maxShift = Math.max(into.maxShift, shift);
    into.sumShift += shift;
  });

  for (let i = 1; i < displayed.length; i++) {
    if (deltaEOK(displayed[i - 1], displayed[i]) < 0.02) into.confusedPairs++;
  }
  if (!isLightnessOrdered(displayed.map(([L]) => L), family)) into.nonMonotonic++;
}

// ---------------------------------------------------------------------------
// Sorties
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const pct = (n: number, total: number) => `${((100 * n) / total).toFixed(0)} %`.padStart(5);
const fmt = (x: number) => x.toFixed(3).replace(/^0/, "");

function printTables(cases: Case[]) {
  const families = ["sequential", "divergent", "divergentSequential"] as const;

  for (const screen of SCREENS) {
    const screenLabel = screen === "p3" ? "Display P3" : "sRGB";
    console.log(`\n=== Écran ${screenLabel} ===\n`);
    console.log(
      "fonction              gamut   palettes  classes hors gamut     palettes touchées   écart affiché max / moy   voisines < .02   L non ordonnée"
    );
    for (const family of families) {
      const subset = cases.filter((c) => c.family === family);
      for (const mode of MODES) {
        const m = emptyMeasure();
        subset.forEach((c) => measure(c.palettes[mode], family, screen, m));
        console.log(
          [
            family.padEnd(21),
            mode.padEnd(7),
            String(m.palettes).padStart(8),
            `${String(m.outOfGamut).padStart(6)}/${String(m.classes).padEnd(5)} ${pct(m.outOfGamut, m.classes)}`.padEnd(22),
            `${String(m.palettesOutOfGamut).padStart(5)} ${pct(m.palettesOutOfGamut, m.palettes)}`.padEnd(19),
            `${fmt(m.maxShift)} / ${fmt(m.sumShift / m.classes)}`.padEnd(25),
            String(m.confusedPairs).padStart(14),
            String(m.nonMonotonic).padStart(16),
          ].join(" ")
        );
      }
    }
  }
  console.log(
    "\nÉcart affiché : ΔE OK entre la couleur calculée et la couleur réellement affichée (écrêtage par canal)."
  );
}

function printDetail(family: string, colorA: string, colorB: string | undefined, steps: number) {
  const A = read(colorA);
  const B = colorB ? read(colorB) : complement(A);
  const both: [number, number] = [steps, steps];
  const palettes: Record<Mode, string[] | Oklch[]> =
    family === "sequential"
      ? {
          none: sequentialOklch(A, colorB ? B : A, steps, "normal"),
          srgb: sequential({ colorStart: colorA, colorEnd: colorB, steps }),
          p3: sequential({ colorStart: colorA, colorEnd: colorB, steps, gamut: "p3" }),
        }
      : family === "divergent"
        ? {
            none: divergentOklch(A, B, both, "normal", true, "oklab"),
            srgb: divergent({ colorA, colorB, steps: both, hasCenterClass: true }),
            p3: divergent({ colorA, colorB, steps: both, hasCenterClass: true, gamut: "p3" }),
          }
        : {
            none: divergentSequentialOklch(A, B, both, "normal", true),
            srgb: divergentSequential({ colorA, colorB, steps: both, hasCenterClass: true }),
            p3: divergentSequential({ colorA, colorB, steps: both, hasCenterClass: true, gamut: "p3" }),
          };

  console.log(`\n${family}(${colorA}${colorB ? `, ${colorB}` : ""}, ${steps} classes${family === "sequential" ? "" : " par côté, centre"})`);
  for (const mode of MODES) {
    console.log(`\n  gamut: "${mode}"`);
    (palettes[mode] as (string | Oklch)[]).forEach((entry, i) => {
      const [l, c, h] = typeof entry === "string" ? readOutput(entry) : entry;
      const flags = SCREENS.map((s) => (isOklchInGamut(l, c, h, s) ? "  ok " : "HORS ")).join("  ");
      const text = `oklch(${(l * 100).toFixed(2)}% ${c.toFixed(4)} ${h.toFixed(2)})`;
      console.log(`    ${String(i).padStart(2)}  ${text.padEnd(30)} sRGB ${flags.slice(0, 5)}  P3 ${flags.slice(7)}`);
    });
  }
}

const detailIndex = args.indexOf("--detail");
if (detailIndex >= 0) {
  const [family, colorA, ...rest] = args.slice(detailIndex + 1);
  const steps = Number(rest[rest.length - 1]);
  const hasSteps = Number.isFinite(steps) && rest.length > 0;
  const colorB = hasSteps ? rest[0] !== String(steps) ? rest[0] : undefined : rest[0];
  printDetail(family, colorA, colorB, hasSteps ? steps : 5);
} else if (args.includes("--json")) {
  const cases = buildCases();
  console.log(JSON.stringify(cases, null, 2));
} else {
  printTables(buildCases());
}
