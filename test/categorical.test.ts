/**
 * Tests of `categorical()` (Node ≥ 22.18, `node:test`, no dependency):
 *
 *   pnpm test
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { categorical, presets, temperature } from "../src/index";
import type { Gamut } from "../src/index";
import { parseCssColor } from "../src/parse";
import { encodeGamma, oklabToLinearSrgb, oklabToOklch, type Oklch } from "../src/oklab";
import { gamutLightnessRange, gamutMaxChroma } from "../src/gamut";

const GAMUTS: Gamut[] = ["srgb", "p3", "cmyk-coated", "cmyk-uncoated", "none"];
const HEXES = ["#e63946", "#2a9d8f", "#ffd166", "#264653", "#8338ec", "#3a86ff", "#808080"];

const oklch = (css: string): Oklch => {
  const lab = parseCssColor(css);
  assert.ok(lab, `unreadable color ${css}`);
  return oklabToOklch(lab);
};

/** oklch() string → 6-digit sRGB hex */
const toHex = (css: string): string => {
  const rgb = oklabToLinearSrgb(parseCssColor(css)!);
  return (
    "#" +
    rgb
      .map((v) => Math.round(Math.min(1, Math.max(0, encodeGamma(v))) * 255))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
};

const hueDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe("categorical() without baseColor", () => {
  test("default palette is unchanged", () => {
    assert.deepEqual(categorical(4), [
      "oklch(70% 0.170 0.00)",
      "oklch(75% 0.136 180.00)",
      "oklch(75% 0.150 90.00)",
      "oklch(50% 0.250 270.00)",
    ]);
  });
});

describe("categorical() with baseColor", () => {
  for (const gamut of ["srgb", "p3", "none"] as const) {
    test(`first color is the hex color (${gamut})`, () => {
      for (const hex of HEXES) {
        for (const count of [1, 2, 5, 12]) {
          const [first] = categorical(count, { baseColor: hex, gamut });
          assert.equal(toHex(first), hex, `${hex}, ${count} colors → ${first}`);
        }
      }
    });
  }

  test("first color is the oklch() color when inside the gamut", () => {
    for (const css of ["oklch(62% 0.2 25)", "oklch(45% 0.08 250)", "oklch(85% 0.1 120.5)"]) {
      const [l, c, h] = oklch(css);
      const [L, C, H] = oklch(categorical(6, { baseColor: css })[0]);
      assert.ok(Math.abs(L - l) < 1e-4, css);
      assert.ok(Math.abs(C - c) < 1e-3, css);
      assert.ok(hueDiff(H, h) < 0.01, css);
    }
  });

  test("first color outside the gamut keeps its lightness and hue, chroma capped", () => {
    const css = "oklch(70% 0.3 145)";
    for (const gamut of ["srgb", "p3", "cmyk-coated"] as const) {
      const [L, C, H] = oklch(categorical(4, { baseColor: css, gamut })[0]);
      const cap = gamutMaxChroma(0.7, 145, gamut);
      assert.ok(Math.abs(L - 0.7) < 1e-4, gamut);
      assert.ok(hueDiff(H, 145) < 0.01, gamut);
      assert.ok(C <= cap + 1e-6 && C > cap - 0.002, `${gamut}: ${C} vs cap ${cap}`);
    }
  });

  test("CMYK: first color keeps its hue, lightness inside the printable range", () => {
    for (const gamut of ["cmyk-coated", "cmyk-uncoated"] as const) {
      const [min, max] = gamutLightnessRange(gamut);
      for (const hex of [...HEXES, "#000000", "#0b132b"]) {
        const [l, c, h] = oklch(hex);
        const [L, C, H] = oklch(categorical(5, { baseColor: hex, gamut })[0]);
        assert.ok(Math.abs(L - Math.min(max, Math.max(min, l))) < 1e-4, `${gamut} ${hex}`);
        assert.ok(C <= c + 5e-4, `${gamut} ${hex}`);
        if (c > 0.02) assert.ok(hueDiff(H, h) < 0.01, `${gamut} ${hex}`);
      }
    }
  });

  test("next colors stay around the color's lightness and chroma", () => {
    for (const hex of HEXES) {
      const [l, c] = oklch(hex);
      const wC = Math.max(0.02, 0.45 * c);
      for (const color of categorical(12, { baseColor: hex }).slice(1)) {
        const [L, C] = oklch(color);
        assert.ok(L >= l - 0.16 - 0.006 && L <= l + 0.04 + 0.006, `${hex}: ${color}`);
        assert.ok(C <= Math.max(0, c - 0.2 * wC) + wC + 0.001, `${hex}: ${color}`);
      }
    }
  });

  test("explicit ranges set the width of the recentred ranges", () => {
    const hex = "#2a9d8f";
    const [l, c] = oklch(hex);
    const colors = categorical(12, {
      baseColor: hex,
      lightnessRange: [0.2, 0.7], // width 0.5
      chromaRange: [0, 0.05], // width 0.05
    });
    assert.equal(toHex(colors[0]), hex);
    for (const color of colors.slice(1)) {
      const [L, C] = oklch(color);
      assert.ok(L >= l - 0.4 - 0.006 && L <= l + 0.1 + 0.006, color);
      assert.ok(C >= 0 && C <= Math.max(0, c - 0.01) + 0.05 + 0.001, color);
    }
  });

  test("lightness range is shifted inside [0, 1] for very light colors", () => {
    for (const color of categorical(8, { baseColor: "#ffffff" })) {
      const [L] = oklch(color);
      assert.ok(L >= 0.8 - 1e-9 && L <= 1, color);
    }
  });

  test("hues start at the color's hue; hueOffset is ignored", () => {
    const hex = "#3a86ff";
    const [, , h] = oklch(hex);
    const a = categorical(8, { baseColor: hex });
    const b = categorical(8, { baseColor: hex, hueOffset: 90 });
    assert.deepEqual(a, b);
    const hues = a.map((color) => oklch(color)[2]);
    // Van der Corput on the full circle: 0, ½, ¼, ¾…
    [0, 180, 90, 270].forEach((step, i) => assert.ok(hueDiff(hues[i], h + step) < 0.05));
  });

  test("an arc keeps its span and is rotated to start at the color's hue", () => {
    const hex = "#2a9d8f";
    const [, , h] = oklch(hex);
    const colors = categorical(6, { ...presets.vif, ...temperature.chaude, baseColor: hex });
    const hues = colors.map((color) => oklch(color)[2]);
    // Arc 330° → 450° (span 120°): both ends first, then the middle
    [0, 120, 60, 30, 90].forEach((step, i) => assert.ok(hueDiff(hues[i], h + step) < 0.05, colors[i]));
  });

  test("adding a class never changes the colors already generated", () => {
    const styles = [{}, presets.vif, presets.pastel, presets.sepia, temperature.froide];
    for (const hex of HEXES) {
      for (const style of styles) {
        for (const gamut of GAMUTS) {
          const options = { ...style, gamut, baseColor: hex };
          const full = categorical(16, options);
          for (let n = 1; n < 16; n++) {
            assert.deepEqual(categorical(n, options), full.slice(0, n), `${hex} ${gamut} ${n}`);
          }
        }
      }
    }
  });

  test("an unreadable color is ignored", () => {
    assert.deepEqual(categorical(6, { baseColor: "not-a-color" }), categorical(6));
  });
});
