import "../../scripts/register-ts.ts";
import { readFileSync } from "node:fs";
import { loadCmyk, roundTrip, oklchToLab, labToOklab, type Cmyk } from "./engine.ts";
const W = new URL("../../src/", import.meta.url).href;
const { sequential } = await import(W + "sequential.ts");
const { divergent } = await import(W + "divergent.ts");
const { presets } = await import(W + "presets.ts");
const { parseCssColor } = await import(W + "parse.ts");
const { oklabToOklch, oklchToOklab, deltaEOK } = await import(W + "oklab.ts");
const { categorical } = await import("./categorical-cap.ts");
const T = JSON.parse(readFileSync("tables.json", "utf8"));
const TH = 2.0;

type Oklch = [number, number, number];
const read = (css: string): Oklch => oklabToOklch(parseCssColor(css)!) as Oklch;

/** exact cap via jsColorEngine bisection */
function exactCap(cm: Cmyk, l: number, h: number) {
  const ok = (c: number) => roundTrip(cm, oklchToLab(l, c, h)).dE < TH;
  if (!ok(0)) return 0; let lo = 0, hi = 0.4;
  for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; ok(m) ? (lo = m) : (hi = m); }
  return lo;
}
/** table cap: bilinear interpolation on (L step 0.02, H step 5°), minus safety margin */
function tableCap(name: string, l: number, h: number, margin = 0.006) {
  const tb = T[name]; const x = Math.min(49.999, Math.max(0, l * 50)), i = Math.floor(x), fx = x - i;
  const y = (((h % 360) + 360) % 360) / 5, j = Math.floor(y) % 72, j2 = (j + 1) % 72, fy = y - Math.floor(y);
  const v = (1 - fx) * ((1 - fy) * tb[i][j] + fy * tb[i][j2]) + fx * ((1 - fy) * tb[i + 1][j] + fy * tb[i + 1][j2]);
  return Math.max(0, v - margin);
}

/** what the press prints: oklch -> Lab -> CMYK (relative) -> Lab -> oklab */
const printed = (cm: Cmyk, [l, c, h]: Oklch) => { const lab = oklchToLab(l, c, h); const r = roundTrip(cm, lab); const p = cm.toLab(r.cmyk); return { dE: r.dE, ok: labToOklab(p[0], p[1], p[2]) }; };
const minNeighbour = (labs: number[][]) => Math.min(...labs.slice(1).map((v, i) => deltaEOK(v as any, labs[i] as any)));
const minAll = (labs: number[][]) => { let m = 9; for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) m = Math.min(m, deltaEOK(labs[i] as any, labs[j] as any)); return m; };

function evaluate(cm: Cmyk, pal: Oklch[], categ: boolean) {
  const pr = pal.map((c) => printed(cm, c));
  const screen = pal.map((c) => oklchToOklab(...c));
  const f = categ ? minAll : minNeighbour;
  return { out: pr.filter((p) => p.dE >= TH).length, maxDE: Math.max(...pr.map((p) => p.dE)), sep: f(screen), sepPrint: f(pr.map((p) => p.ok)) };
}

const CASES: [string, () => string[], boolean][] = [
  ["seq steelblue 7", () => sequential({ colorStart: "steelblue", steps: 7 }), false],
  ["seq #2b83ba 9 high", () => sequential({ colorStart: "#2b83ba", steps: 9, contrast: "high" }), false],
  ["seq #008837 7", () => sequential({ colorStart: "#008837", steps: 7 }), false],
  ["seq #7b3294 7", () => sequential({ colorStart: "#7b3294", steps: 7 }), false],
  ["seq #d7191c 7", () => sequential({ colorStart: "#d7191c", steps: 7 }), false],
  ["seq gold 5", () => sequential({ colorStart: "gold", steps: 5 }), false],
  ["seq #f4e285→#1d3557 7", () => sequential({ colorStart: "#f4e285", colorEnd: "#1d3557", steps: 7 }), false],
  ["div #d7191c/#2b83ba 5+5", () => divergent({ colorA: "#d7191c", colorB: "#2b83ba", steps: [5, 5] }), false],
  ["div #7b3294/#008837 4+4", () => divergent({ colorA: "#7b3294", colorB: "#008837", steps: [4, 4] }), false],
  ["cat vif 8", () => categorical(8, presets.vif), true],
  ["cat vif 12", () => categorical(12, presets.vif), true],
  ["cat pastel 8", () => categorical(8, presets.pastel), true],
];

for (const name of ["fogra39", "fogra29"]) {
  const cm = await loadCmyk(name);
  console.log(`\n=== ${name}  (hors gamut = aller-retour ΔE00 ≥ ${TH}; sép. = ΔE OK min entre classes voisines (séq/div) ou toutes paires (catég.))`);
  console.log("palette".padEnd(26), "| sRGB actuel: hors/n  ΔE00 max  sép.écran→imprimé | cap CMJN (table): hors/n ΔE00 max  sép.écran→imprimé | cap exact hors");
  for (const [label, gen, categ] of CASES) {
    (globalThis as any).__cap = undefined;
    const base = gen().map(read);
    const a = evaluate(cm, base, categ);
    let capped: Oklch[];
    if (categ) { (globalThis as any).__cap = (l: number, h: number) => tableCap(name, l, h); capped = gen().map(read); (globalThis as any).__cap = undefined; }
    else capped = base.map(([l, c, h]) => [l, Math.min(c, tableCap(name, l, h)), h]);
    const b = evaluate(cm, capped, categ);
    const exact = base.map(([l, c, h]) => [l, Math.min(c, exactCap(cm, l, h)), h] as Oklch);
    const e = evaluate(cm, exact, categ);
    const fmt = (r: any, n: number) => `${r.out}/${n}`.padStart(5) + r.maxDE.toFixed(1).padStart(9) + `  ${r.sep.toFixed(3)}→${r.sepPrint.toFixed(3)}`.padStart(17);
    console.log(label.padEnd(26), "|", fmt(a, base.length).padEnd(38), "|", fmt(b, capped.length).padEnd(39), "|", `${e.out}/${base.length}`);
  }
}
