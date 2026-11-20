/**
 * Génère `src/cmyk-gamuts.data.ts` : pour chaque gamut CMJN, la chroma OKLCH
 * maximale imprimable par (luminosité, teinte) et la plage de luminosité
 * imprimable.
 *
 * Les profils ICC ne sont lus qu'ici, par jsColorEngine (devDependency) :
 * la bibliothèque ne livre que les tables (≈ 1,7 Ko gzip par gamut) et reste
 * sans dépendance.
 *
 * Chaque gamut est l'intersection de plusieurs profils (voir `cmykSources`) :
 * une couleur n'y entre que si elle est imprimable avec chacun. Méthode :
 *
 * - une couleur est imprimable avec un profil si l'aller-retour
 *   Lab → CMJN → Lab, en colorimétrie relative sans compensation du point noir
 *   (ce que fera l'export d'une palette déjà dans le gamut), s'écarte de moins
 *   de ΔE00 = `ROUND_TRIP_LIMIT`. Le bruit propre aux profils est de ≈ 0,5 en
 *   médiane et ≈ 1 au 95ᵉ centile sur des couleurs imprimables ;
 * - chroma maximale par dichotomie sur la grille `GRID`, puis on retire
 *   `CHROMA_MARGIN` (l'interpolation bilinéaire de la grille ne doit pas
 *   déborder du gamut) ;
 * - plancher de luminosité, le plus haut de deux seuils :
 *   - L OKLab du noir le plus profond imprimable (le plus clair des profils),
 *     plus `BLACK_MARGIN` : en dessous, les classes sombres se confondent à
 *     l'impression ;
 *   - la plus basse luminosité où la chroma imprimable médiane (sur les
 *     teintes) atteint `MIN_DARK_CHROMA` : le gamut se referme en pointe vers
 *     le noir, et une classe plus sombre ne garderait presque plus sa teinte
 *     (elle virerait au gris, en rupture avec le reste de la rampe).
 *
 * Usage (Node ≥ 22.18) :
 *
 *   node scripts/build-cmyk-gamuts.ts
 *   node scripts/build-cmyk-gamuts.ts --profile cmyk-coated=/a.icc,/b.icc
 */

import { writeFileSync } from "node:fs";
import "./register-ts.ts";

const { cmykSources, jsce, labToOklab, loadCmykProfile, oklchToLab, ROUND_TRIP_LIMIT } = await import(
  "./cmyk-profile.ts"
);

/** Marge retirée à la chroma maximale (OKLCH) */
const CHROMA_MARGIN = 0.006;
/** Marge ajoutée au noir imprimable (OKLab L) */
const BLACK_MARGIN = 0.04;
/** Chroma OKLCH médiane minimale de la classe la plus sombre */
const MIN_DARK_CHROMA = 0.06;
/**
 * Grille : L de 0 à 1 (pas 0,02), H de 0 à 355° (pas 5°), chroma codée sur un
 * octet (pas 0,0012, jusqu'à 0,306 : la chroma CMJN ne dépasse pas ≈ 0,25).
 */
const GRID = { lSteps: 51, hSteps: 72, chromaScale: 0.0012 };

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const { lSteps, hSteps, chromaScale } = GRID;

/**
 * Codage différentiel le long des teintes (modulo 256) : la chroma varie peu
 * d'une teinte à la suivante, les écarts se compressent bien mieux (gzip)
 * que les valeurs brutes.
 */
const deltaEncode = (bytes: Uint8Array) =>
  bytes.map((v, k) => (k % hSteps === 0 ? v : (v - bytes[k - 1]) & 255));
const out: string[] = [];

for (const [id, { label, profiles }] of Object.entries(cmykSources())) {
  const cmyks = await Promise.all(profiles.map(({ path }) => loadCmykProfile(path)));
  const printable = (l: number, c: number, h: number) => {
    const lab = oklchToLab(l, c, h);
    return cmyks.every((cmyk) => cmyk.printable(lab));
  };

  // Noir le plus profond imprimable avec tous les profils
  const blacks = cmyks.map((cmyk) => labToOklab(cmyk.printed([0, 0, 0]))[0]);
  const bytes = new Uint8Array(lSteps * hSteps);
  let clipped = 0;
  for (let i = 0; i < lSteps; i++) {
    const l = i / (lSteps - 1);
    for (let j = 0; j < hSteps; j++) {
      const h = (j * 360) / hSteps;
      let max = 0;
      if (l > 0 && l < 1 && printable(l, 0, h)) {
        let lo = 0;
        let hi = 0.4;
        for (let k = 0; k < 16; k++) {
          const mid = (lo + hi) / 2;
          if (printable(l, mid, h)) lo = mid;
          else hi = mid;
        }
        max = Math.max(0, lo - CHROMA_MARGIN);
      }
      const q = Math.floor(max / chromaScale);
      if (q > 255) clipped++;
      bytes[i * hSteps + j] = Math.min(255, q);
    }
  }
  if (clipped) console.warn(`${id} : ${clipped} valeurs au-delà de l'échelle, écrêtées`);

  // Plancher : noir imprimable + marge, ou chroma médiane suffisante (grille interpolée)
  const blackFloor = Math.ceil((Math.max(...blacks) + BLACK_MARGIN) * 100) / 100;
  const medianChroma = (l: number) => {
    const x = l * (lSteps - 1);
    const i = Math.min(lSteps - 2, Math.floor(x));
    const f = x - i;
    const row = Array.from({ length: hSteps }, (_, j) =>
      ((1 - f) * bytes[i * hSteps + j] + f * bytes[(i + 1) * hSteps + j]) * chromaScale
    ).sort((a, b) => a - b);
    return row[hSteps >> 1];
  };
  let chromaFloor = 0;
  while (chromaFloor < 1 && medianChroma(chromaFloor) < MIN_DARK_CHROMA) chromaFloor = Math.round((chromaFloor + 0.01) * 100) / 100;
  const minLightness = Math.max(blackFloor, chromaFloor);

  console.log(`${id} — ${label}`);
  cmyks.forEach((cmyk, k) => console.log(`  ${profiles[k].standard} : ${cmyk.description}, noir OKLab L ${blacks[k].toFixed(3)}`));
  console.log(`  plancher de luminosité ${minLightness} (noir + marge ${blackFloor}, chroma médiane ≥ ${MIN_DARK_CHROMA} : ${chromaFloor})`);
  out.push(`  "${id}": {
    label: ${JSON.stringify(label)},
    profiles: ${JSON.stringify(cmyks.map((cmyk) => cmyk.description))},
    minLightness: ${minLightness},
    chroma: ${JSON.stringify(Buffer.from(deltaEncode(bytes)).toString("base64"))},
  },`);
}

const file = `// Fichier généré par scripts/build-cmyk-gamuts.ts — ne pas modifier à la main.
// jsColorEngine ${jsce.version}, colorimétrie relative sans BPC,
// aller-retour < ΔE00 ${ROUND_TRIP_LIMIT}, marge de chroma ${CHROMA_MARGIN},
// plancher : noir + ${BLACK_MARGIN} ou chroma médiane ≥ ${MIN_DARK_CHROMA}.

import type { CmykGamutData } from "./cmyk-gamuts";
import type { CmykGamut } from "./types";

/** Grille des tables de chroma (voir \`cmykMaxChroma\`) */
export const CMYK_GRID = { lSteps: ${GRID.lSteps}, hSteps: ${GRID.hSteps}, chromaScale: ${GRID.chromaScale} };

export const CMYK_GAMUT_DATA: Record<CmykGamut, CmykGamutData> = {
${out.join("\n")}
};
`;
writeFileSync(new URL("../src/cmyk-gamuts.data.ts", import.meta.url), file);
console.log("→ src/cmyk-gamuts.data.ts");
