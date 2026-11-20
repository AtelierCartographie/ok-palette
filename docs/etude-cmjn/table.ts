import { writeFileSync } from "node:fs";
import { loadCmyk, roundTrip, oklchToLab, type Cmyk } from "./engine.ts";
import { maxChroma } from "../../src/oklab.ts";
export const TH = 2.0;
const inG = (cm: Cmyk, l: number, c: number, h: number) => roundTrip(cm, oklchToLab(l, c, h)).dE < TH;
function maxC(cm: Cmyk, l: number, h: number) {
  if (!inG(cm, l, 0, h)) return 0;
  let lo = 0, hi = 0.4;
  for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (inG(cm, l, m, h)) lo = m; else hi = m; }
  return lo;
}
const Ls = Array.from({ length: 51 }, (_, i) => i / 50);       // L 0..1 step 0.02
const Hs = Array.from({ length: 72 }, (_, i) => i * 5);        // H step 5°
const out: any = { L: Ls, H: Hs };
for (const name of ["fogra39", "fogra29"]) {
  const cm = await loadCmyk(name);
  const t0 = performance.now();
  out[name] = Ls.map((l) => Hs.map((h) => +maxC(cm, l, h).toFixed(4)));
  console.log(name, "table built in", ((performance.now() - t0) / 1000).toFixed(1), "s");
}
out.srgb = Ls.map((l) => Hs.map((h) => +maxChroma(l, h, "srgb").toFixed(4)));
writeFileSync("tables.json", JSON.stringify(out));
// summary per hue: cusp chroma, and share of sRGB slice area kept
const hueNames: Record<number, string> = { 25: "rouge", 55: "orange", 90: "jaune", 140: "vert", 195: "cyan", 250: "bleu", 300: "violet", 345: "magenta" };
console.log("teinte    | Cmax sRGB | Cmax F39 | Cmax F29 | aire F39∩sRGB / sRGB | F29∩sRGB / sRGB | F39 hors sRGB");
for (const [h, n] of Object.entries(hueNames)) {
  const j = Hs.indexOf(+h);
  const col = (k: string) => Ls.map((_, i) => out[k][i][j]);
  const s = col("srgb"), a = col("fogra39"), b = col("fogra29");
  const sum = (x: number[]) => x.reduce((p, q) => p + q, 0);
  const inter = (x: number[]) => sum(x.map((v, i) => Math.min(v, s[i])));
  const outside = sum(a.map((v, i) => Math.max(0, v - s[i])));
  console.log(n.padEnd(9), "|", Math.max(...s).toFixed(3).padStart(9), "|", Math.max(...a).toFixed(3).padStart(8), "|", Math.max(...b).toFixed(3).padStart(8), "|",
    ((inter(a) / sum(s)) * 100).toFixed(0).padStart(19) + " %", "|", ((inter(b) / sum(s)) * 100).toFixed(0).padStart(13) + " %", "|", ((outside / sum(s)) * 100).toFixed(0).padStart(5) + " %");
}
