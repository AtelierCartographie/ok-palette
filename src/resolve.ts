import type { CSSColor, WebGLColor, ColorFormat } from "./types";

/**
 * Creates a shared OffscreenCanvas 2D context (lazy singleton).
 *
 * OffscreenCanvas is used to avoid touching the main DOM.
 * The `willReadFrequently` flag optimizes repeated pixel reads.
 */
let _ctx: OffscreenCanvasRenderingContext2D | null = null;

function getContext(): OffscreenCanvasRenderingContext2D {
  if (!_ctx) {
    _ctx = new OffscreenCanvas(1, 1).getContext("2d", {
      willReadFrequently: true,
    });
    if (!_ctx) {
      throw new Error("Could not create an OffscreenCanvas 2D context");
    }
  }
  return _ctx;
}

/**
 * Resolves a complex CSS color to a usable value.
 *
 * **`"css"` format** (default): returns the color as computed by the browser
 * (may be `oklch(…)`, `rgba(…)`, etc.).
 *
 * **`"webgl"` format**: draws a pixel and reads raw data to obtain a
 * `[r, g, b, a]` tuple (0–255). This is the most reliable approach
 * as it handles oklch, display-p3, lab, etc.
 *
 * @example
 * ```ts
 * resolveColor("color-mix(in oklch, red, blue 50%)");
 * // → "oklch(0.546 0.223 351.6)" (browser-dependent)
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

  // Assign the color so the browser parses it
  ctx.fillStyle = color;

  if (format === "css") {
    return ctx.fillStyle;
  }

  // WebGL format: draw + read pixel to reliably get sRGB values
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const { data } = ctx.getImageData(0, 0, 1, 1);

  return [data[0], data[1], data[2], data[3]];
}

/**
 * Resolves a full array of CSS colors.
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
