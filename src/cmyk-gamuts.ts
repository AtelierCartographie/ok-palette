// ---------------------------------------------------------------------------
// CMYK printing gamuts
//
// Unlike sRGB and Display P3, a CMYK gamut has no formula: it is measured
// (an ICC profile). `scripts/build-cmyk-gamuts.ts` reads the profiles once with
// jsColorEngine and stores, for each printing condition, the maximum
// printable OKLCH chroma on an (L, H) grid plus the printable lightness floor.
// ---------------------------------------------------------------------------

import { CMYK_GAMUT_DATA, CMYK_GRID } from "./cmyk-gamuts.data";
import type { CmykGamut, Range } from "./types";

/** Data of one CMYK printing condition (generated) */
export interface CmykGamutData {
  /** Human-readable name of the printing condition */
  label: string;
  /**
   * ICC profiles the table was computed from: a color is in the gamut only if
   * it is printable with every one of them
   */
  profiles: readonly string[];
  /**
   * Lowest OKLab lightness that still prints distinctly: deepest printable
   * black plus a margin. Darker colors all print as that black.
   */
  minLightness: number;
  /**
   * Maximum printable OKLCH chroma (unit `CMYK_GRID.chromaScale`), one byte
   * per grid point, row-major: `lSteps` lightness rows (0 → 1) × `hSteps`
   * hues (0° → 360°). Each row is delta-coded along the hue (modulo 256),
   * then the whole table is base64-encoded.
   */
  chroma: string;
}

const CMYK_GAMUTS: readonly string[] = Object.keys(CMYK_GAMUT_DATA);

/** Whether a gamut is one of the CMYK printing conditions */
export function isCmykGamut(gamut: string): gamut is CmykGamut {
  return CMYK_GAMUTS.includes(gamut);
}

/** Decoded chroma tables, built on first use */
const tables = new Map<CmykGamut, Uint8Array>();

function chromaTable(gamut: CmykGamut): Uint8Array {
  let table = tables.get(gamut);
  if (!table) {
    const { hSteps } = CMYK_GRID;
    const bin = atob(CMYK_GAMUT_DATA[gamut].chroma);
    table = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    for (let k = 0; k < table.length; k++) {
      if (k % hSteps !== 0) table[k] = (table[k] + table[k - 1]) & 255;
    }
    tables.set(gamut, table);
  }
  return table;
}

/**
 * Maximum OKLCH chroma printable in the given CMYK condition for a lightness
 * and hue (bilinear interpolation of the generated grid). Not bounded by sRGB:
 * CMYK exceeds sRGB in some cyans and yellows.
 */
export function cmykMaxChroma(l: number, h: number, gamut: CmykGamut): number {
  const { lSteps, hSteps, chromaScale } = CMYK_GRID;
  const table = chromaTable(gamut);

  const x = Math.min(1, Math.max(0, l)) * (lSteps - 1);
  const i = Math.min(lSteps - 2, Math.floor(x));
  const fx = x - i;

  const y = ((((h % 360) + 360) % 360) / 360) * hSteps;
  const j = Math.floor(y) % hSteps;
  const j2 = (j + 1) % hSteps;
  const fy = y - Math.floor(y);

  const at = (row: number, col: number) => table[row * hSteps + col];
  const top = (1 - fy) * at(i, j) + fy * at(i, j2);
  const bottom = (1 - fy) * at(i + 1, j) + fy * at(i + 1, j2);
  return ((1 - fx) * top + fx * bottom) * chromaScale;
}

/** Printable OKLab lightness range of a CMYK condition (paper white = 1) */
export function cmykLightnessRange(gamut: CmykGamut): Range {
  return [CMYK_GAMUT_DATA[gamut].minLightness, 1];
}
