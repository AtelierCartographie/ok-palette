/**
 * Lightness level choice of `categorical()` when the aimed chroma is out of
 * the gamut (Node ≥ 22.18, `node:test`, no dependency):
 *
 *   pnpm test
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { categorical, presets, temperature } from "../src/index";
import type { CategoricalColorOptions, Gamut } from "../src/index";
import { clampLightnessRange, gamutMaxChroma } from "../src/gamut";

const GAMUTS: Gamut[] = ["srgb", "p3", "cmyk-coated", "cmyk-uncoated"];

/** Very saturated "first color" oklch(85% 0.34 233), as the web generator derives it */
const SATURATED: CategoricalColorOptions = {
  hueRange: [0, 360],
  hueOffset: 233,
  lightnessRange: [0.69, 0.89],
  chromaRange: [0.309, 0.462],
};

const parse = (css: string) => {
  const m = css.match(/^oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)$/);
  assert.ok(m, `unexpected color ${css}`);
  return { l: Number(m[1]) / 100, c: Number(m[2]), h: Number(m[3]) };
};

/**
 * Best chroma the hue can hold on the 11 levels of `lightnessRange`, within
 * the targets of `chromaRange` (light levels aim at its low end).
 */
function reachableChroma(h: number, opts: CategoricalColorOptions, gamut: Gamut): number {
  const [lo, hi] = clampLightnessRange(opts.lightnessRange!, gamut);
  const [cLo, cHi] = opts.chromaRange!;
  let best = 0;
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    const target = cLo + (cHi - cLo) * (1 - t);
    best = Math.max(best, Math.min(target, gamutMaxChroma(lo + (hi - lo) * t, h, gamut)));
  }
  return best;
}

/** Chroma of the palest class relative to what its hue could reach (≥ 1 = none lost) */
function worstChromaShare(colors: string[], opts: CategoricalColorOptions, gamut: Gamut): number {
  return Math.min(
    ...colors.map((css) => {
      const { c, h } = parse(css);
      return c / Math.min(opts.chromaRange![0], reachableChroma(h, opts, gamut));
    })
  );
}

describe("categorical() — chroma out of the gamut", () => {
  test("saturated first color: no class much paler than the others", () => {
    for (const gamut of GAMUTS) {
      const colors = categorical(6, { ...SATURATED, gamut });
      // Before the fix: p3 class 5 at oklch(89% 0.059 278) (reachable ≈ 0.18),
      // cmyk-coated class 3 at oklch(89% 0.036 323) (reachable ≈ 0.095)
      assert.ok(
        worstChromaShare(colors, SATURATED, gamut) >= 0.6,
        `${gamut}: ${colors.join(", ")}`
      );
    }
    const p3 = categorical(6, { ...SATURATED, gamut: "p3" }).map(parse);
    assert.ok(Math.min(...p3.map((x) => x.c)) > 0.15, "p3: every class keeps C > 0.15");
  });

  test("every class keeps ≥ 60 % of the chroma its hue can reach (presets × temperatures × gamuts, 2–16)", () => {
    const configs: CategoricalColorOptions[] = [SATURATED];
    for (const p of Object.values(presets))
      for (const t of Object.values(temperature)) configs.push({ ...p, ...t });
    for (const opts of configs)
      for (const gamut of GAMUTS)
        for (let n = 2; n <= 16; n++) {
          const share = worstChromaShare(categorical(n, { ...opts, gamut }), opts, gamut);
          // 0.001 of rounding (chroma is written with 3 decimals)
          assert.ok(share >= 0.59, `${JSON.stringify(opts)} ${gamut} n=${n}: ${share.toFixed(3)}`);
        }
  });

  test("adding a class never changes the previous ones", () => {
    for (const gamut of GAMUTS) {
      const full = categorical(16, { ...SATURATED, gamut });
      for (let n = 1; n < 16; n++)
        assert.deepEqual(categorical(n, { ...SATURATED, gamut }), full.slice(0, n), `${gamut} n=${n}`);
    }
  });

  test("screen palettes of the presets are unchanged", () => {
    assert.deepEqual(categorical(8, { ...presets.vif }), [
      "oklch(75% 0.164 0.00)",
      "oklch(80% 0.145 180.00)",
      "oklch(78% 0.157 90.00)",
      "oklch(55% 0.220 270.00)",
      "oklch(55% 0.157 45.00)",
      "oklch(65% 0.123 225.00)",
      "oklch(60% 0.175 135.00)",
      "oklch(63% 0.199 315.00)",
    ]);
  });
});
