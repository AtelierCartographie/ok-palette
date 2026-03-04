import type { CSSColor, WebGLColor, ColorFormat } from "./types";

/**
 * Crée un contexte OffscreenCanvas 2D partagé (singleton paresseux).
 *
 * On utilise OffscreenCanvas pour ne jamais toucher au DOM principal.
 * Le flag `willReadFrequently` optimise les lectures répétées de pixels.
 */
let _ctx: OffscreenCanvasRenderingContext2D | null = null;

function getContext(): OffscreenCanvasRenderingContext2D {
  if (!_ctx) {
    _ctx = new OffscreenCanvas(1, 1).getContext("2d", {
      willReadFrequently: true,
    });
    if (!_ctx) {
      throw new Error("Impossible de créer un contexte OffscreenCanvas 2D");
    }
  }
  return _ctx;
}

/**
 * Résout une couleur CSS complexe vers une valeur exploitable.
 *
 * **Format `"css"`** (défaut) : retourne la couleur telle que le navigateur
 * l'a calculée (peut être `oklch(…)`, `rgba(…)`, etc.).
 *
 * **Format `"webgl"`** : dessine un pixel et lit les données brutes pour
 * obtenir un tuple `[r, g, b, a]` (0–255). C'est l'approche la plus fiable
 * car elle gère oklch, display-p3, lab, etc.
 *
 * @example
 * ```ts
 * resolveColor("color-mix(in oklch, red, blue 50%)");
 * // → "oklch(0.546 0.223 351.6)" (selon le navigateur)
 *
 * resolveColor("color-mix(in oklch, red, blue 50%)", { format: "webgl" });
 * // → [188, 0, 182, 255]
 * ```
 */
export function resolveColor(color: string, options?: { format: "css" }): CSSColor;
export function resolveColor(color: string, options: { format: "webgl" }): WebGLColor;
export function resolveColor(
  color: string,
  { format = "css" }: { format?: ColorFormat } = {}
): CSSColor | WebGLColor {
  const ctx = getContext();

  // Assigner la couleur pour que le navigateur la parse
  ctx.fillStyle = color;

  if (format === "css") {
    return ctx.fillStyle;
  }

  // Format WebGL : dessin + lecture du pixel pour être sûr d'obtenir du sRGB
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const { data } = ctx.getImageData(0, 0, 1, 1);

  return [data[0], data[1], data[2], data[3]];
}

/**
 * Résout un tableau complet de couleurs CSS.
 *
 * @example
 * ```ts
 * resolvePalette(palette, { format: "webgl" });
 * // → [[255, 0, 0, 255], [0, 0, 255, 255], …]
 * ```
 */
export function resolvePalette(colors: CSSColor[], options?: { format: "css" }): CSSColor[];
export function resolvePalette(colors: CSSColor[], options: { format: "webgl" }): WebGLColor[];
export function resolvePalette(
  colors: CSSColor[],
  { format = "css" }: { format?: ColorFormat } = {}
): (CSSColor | WebGLColor)[] {
  if (format === "webgl") {
    return colors.map((c) => resolveColor(c, { format: "webgl" }));
  }
  return colors.map((c) => resolveColor(c, { format: "css" }));
}
