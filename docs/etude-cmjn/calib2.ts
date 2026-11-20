import { jsce, loadCmyk, roundTrip } from "./engine.ts";
for (const name of ["fogra39", "fogra29"]) {
  const cm = await loadCmyk(name);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const buckets: Record<string, number[]> = {};
  for (let i = 0; i < 6000; i++) {
    let c = [rnd(), rnd(), rnd(), rnd() * rnd()].map((v) => v * 100);
    const tac = c.reduce((a, b) => a + b); if (tac > 280) c = c.map((v) => (v * 280) / tac);
    const lab = cm.toLab(jsce.color.CMYK(c[0], c[1], c[2], c[3]));
    const k = `L${Math.min(9, Math.floor(lab[0] / 10))}0`;
    (buckets[k] ??= []).push(roundTrip(cm, lab).dE);
  }
  console.log(name);
  for (const k of Object.keys(buckets).sort()) {
    const e = buckets[k].sort((a, b) => a - b);
    console.log(" ", k, "n", e.length, "p50", e[e.length >> 1].toFixed(2), "p95", e[Math.floor(e.length * 0.95)].toFixed(2));
  }
}
