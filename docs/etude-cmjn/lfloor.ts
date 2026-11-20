import "../../scripts/register-ts.ts";
import { readFileSync } from "node:fs";
import { loadCmyk, roundTrip, oklchToLab, labToOklab, type Cmyk } from "./engine.ts";
const W = new URL("../../src/", import.meta.url).href;
const { sequentialOklch } = await import(W + "sequential.ts");
const { parseCssColor } = await import(W + "parse.ts");
const { oklabToOklch, maxChroma, deltaEOK } = await import(W + "oklab.ts");
const T = JSON.parse(readFileSync("tables.json", "utf8"));
type O = [number, number, number];
const read = (c: string) => oklabToOklch(parseCssColor(c)!) as O;
function tableCap(name: string, l: number, h: number, m = 0.006) {
  const tb = T[name]; const x = Math.min(49.999, Math.max(0, l * 50)), i = Math.floor(x), fx = x - i;
  const y = (((h % 360) + 360) % 360) / 5, j = Math.floor(y) % 72, j2 = (j + 1) % 72, fy = y - Math.floor(y);
  return Math.max(0, (1 - fx) * ((1 - fy) * tb[i][j] + fy * tb[i][j2]) + fx * ((1 - fy) * tb[i + 1][j] + fy * tb[i + 1][j2]) - m);
}
const cap = (name: string, p: O[]) => p.map(([l, c, h]) => [l, Math.min(c, maxChroma(l, h, "srgb"), tableCap(name, l, h)), h] as O);
const printedSep = (cm: Cmyk, p: O[]) => { const o = p.map(([l, c, h]) => { const lab = oklchToLab(l, c, h); const q = cm.toLab(cm.toCmyk(lab)); return labToOklab(q[0], q[1], q[2]); }); return { min: Math.min(...o.slice(1).map((v, i) => deltaEOK(v, o[i]))), out: p.filter(([l, c, h]) => roundTrip(cm, oklchToLab(l, c, h)).dE >= 2).length }; };
const LB: Record<string, number> = { fogra39: 0.229, fogra29: 0.396 };
for (const name of ["fogra39", "fogra29"]) {
  const cm = await loadCmyk(name);
  console.log(`\n${name} (noir OKLab L=${LB[name]})   sép. imprimée min entre voisines / classes hors gamut`);
  for (const [col, steps, contrast] of [["#2b83ba", 9, "high"], ["#2b83ba", 9, "normal"], ["#7b3294", 7, "normal"], ["#008837", 5, "high"]] as const) {
    const s = read(col);
    const base = sequentialOklch(s, s, steps, contrast) as O[];
    const capOnly = cap(name, base);
    // lightness floor: re-interpolate with end lightness raised to the black point (+ margin)
    const floorL = LB[name] + 0.04;
    const Ls = base.map((c) => c[0]); const top = Ls[0], bot = Ls[Ls.length - 1];
    const remapped = cap(name, base.map(([l, c, h]) => [bot >= floorL ? l : floorL + ((l - bot) * (top - floorL)) / (top - bot), c, h] as O));
    const a = printedSep(cm, capOnly), b = printedSep(cm, remapped);
    console.log(`  seq ${col} ${steps} ${contrast}`.padEnd(30), `L ${top.toFixed(2)}→${bot.toFixed(2)}`, "| chroma seule:", a.min.toFixed(3), `${a.out}/${steps}`, "| chroma + plancher L:", b.min.toFixed(3), `${b.out}/${steps}`, `(L→${floorL.toFixed(2)})`);
  }
}
