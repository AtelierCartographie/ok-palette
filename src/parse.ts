// ---------------------------------------------------------------------------
// CSS color parsing → OKLab
//
// Gamut mapping needs the input colors as numbers. Common CSS syntaxes are
// parsed in JS (works in Node too); anything else (relative colors,
// color-mix(), var(), system colors…) is resolved by the browser when one is
// available. Returns `null` when the color cannot be read.
// ---------------------------------------------------------------------------

import {
  decodeGamma,
  linearP3ToLinearSrgb,
  linearSrgbToOklab,
  oklchToOklab,
  type Oklab,
  type Rgb,
} from "./oklab";

/** CSS named colors (CSS Color 4), as 6-digit hex */
const NAMED_COLORS: Record<string, string> = Object.fromEntries(
  (
    "aliceblue:f0f8ff,antiquewhite:faebd7,aqua:00ffff,aquamarine:7fffd4,azure:f0ffff,beige:f5f5dc," +
    "bisque:ffe4c4,black:000000,blanchedalmond:ffebcd,blue:0000ff,blueviolet:8a2be2,brown:a52a2a," +
    "burlywood:deb887,cadetblue:5f9ea0,chartreuse:7fff00,chocolate:d2691e,coral:ff7f50," +
    "cornflowerblue:6495ed,cornsilk:fff8dc,crimson:dc143c,cyan:00ffff,darkblue:00008b,darkcyan:008b8b," +
    "darkgoldenrod:b8860b,darkgray:a9a9a9,darkgreen:006400,darkgrey:a9a9a9,darkkhaki:bdb76b," +
    "darkmagenta:8b008b,darkolivegreen:556b2f,darkorange:ff8c00,darkorchid:9932cc,darkred:8b0000," +
    "darksalmon:e9967a,darkseagreen:8fbc8f,darkslateblue:483d8b,darkslategray:2f4f4f," +
    "darkslategrey:2f4f4f,darkturquoise:00ced1,darkviolet:9400d3,deeppink:ff1493,deepskyblue:00bfff," +
    "dimgray:696969,dimgrey:696969,dodgerblue:1e90ff,firebrick:b22222,floralwhite:fffaf0," +
    "forestgreen:228b22,fuchsia:ff00ff,gainsboro:dcdcdc,ghostwhite:f8f8ff,gold:ffd700,goldenrod:daa520," +
    "gray:808080,green:008000,greenyellow:adff2f,grey:808080,honeydew:f0fff0,hotpink:ff69b4," +
    "indianred:cd5c5c,indigo:4b0082,ivory:fffff0,khaki:f0e68c,lavender:e6e6fa,lavenderblush:fff0f5," +
    "lawngreen:7cfc00,lemonchiffon:fffacd,lightblue:add8e6,lightcoral:f08080,lightcyan:e0ffff," +
    "lightgoldenrodyellow:fafad2,lightgray:d3d3d3,lightgreen:90ee90,lightgrey:d3d3d3,lightpink:ffb6c1," +
    "lightsalmon:ffa07a,lightseagreen:20b2aa,lightskyblue:87cefa,lightslategray:778899," +
    "lightslategrey:778899,lightsteelblue:b0c4de,lightyellow:ffffe0,lime:00ff00,limegreen:32cd32," +
    "linen:faf0e6,magenta:ff00ff,maroon:800000,mediumaquamarine:66cdaa,mediumblue:0000cd," +
    "mediumorchid:ba55d3,mediumpurple:9370db,mediumseagreen:3cb371,mediumslateblue:7b68ee," +
    "mediumspringgreen:00fa9a,mediumturquoise:48d1cc,mediumvioletred:c71585,midnightblue:191970," +
    "mintcream:f5fffa,mistyrose:ffe4e1,moccasin:ffe4b5,navajowhite:ffdead,navy:000080,oldlace:fdf5e6," +
    "olive:808000,olivedrab:6b8e23,orange:ffa500,orangered:ff4500,orchid:da70d6,palegoldenrod:eee8aa," +
    "palegreen:98fb98,paleturquoise:afeeee,palevioletred:db7093,papayawhip:ffefd5,peachpuff:ffdab9," +
    "peru:cd853f,pink:ffc0cb,plum:dda0dd,powderblue:b0e0e6,purple:800080,rebeccapurple:663399," +
    "red:ff0000,rosybrown:bc8f8f,royalblue:4169e1,saddlebrown:8b4513,salmon:fa8072,sandybrown:f4a460," +
    "seagreen:2e8b57,seashell:fff5ee,sienna:a0522d,silver:c0c0c0,skyblue:87ceeb,slateblue:6a5acd," +
    "slategray:708090,slategrey:708090,snow:fffafa,springgreen:00ff7f,steelblue:4682b4,tan:d2b48c," +
    "teal:008080,thistle:d8bfd8,tomato:ff6347,turquoise:40e0d0,violet:ee82ee,wheat:f5deb3,white:ffffff," +
    "whitesmoke:f5f5f5,yellow:ffff00,yellowgreen:9acd32"
  )
    .split(",")
    .map((entry) => entry.split(":"))
);

// ---------------------------------------------------------------------------
// Conversions only needed for parsing
// ---------------------------------------------------------------------------

/** Gamma-encoded sRGB (0–1) → OKLab */
const srgbToOklab = (rgb: Rgb): Oklab => linearSrgbToOklab(rgb.map(decodeGamma) as Rgb);

/** XYZ (D65) → linear sRGB */
function xyzD65ToLinearSrgb([x, y, z]: Rgb): Rgb {
  return [
    3.2409699419 * x - 1.5373831776 * y - 0.4986107603 * z,
    -0.9692436363 * x + 1.8759675015 * y + 0.0415550574 * z,
    0.0556300797 * x - 0.2039769589 * y + 1.0569715142 * z,
  ];
}

/** XYZ (D50) → XYZ (D65), Bradford chromatic adaptation */
function xyzD50ToD65([x, y, z]: Rgb): Rgb {
  return [
    0.9554734215 * x - 0.0230984549 * y + 0.0632592432 * z,
    -0.0283697093 * x + 1.009995398 * y + 0.0210414412 * z,
    0.0123140149 * x - 0.0205076493 * y + 1.3303659262 * z,
  ];
}

/** CIE Lab (D50) → OKLab */
function cieLabToOklab(L: number, a: number, b: number): Oklab {
  const kappa = 24389 / 27;
  const epsilon = 216 / 24389;
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa;
  const y = L > kappa * epsilon ? fy ** 3 : L / kappa;
  const z = fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa;
  const d50: Rgb = [x * 0.3457 / 0.3585, y, z * (1 - 0.3457 - 0.3585) / 0.3585];
  return linearSrgbToOklab(xyzD65ToLinearSrgb(xyzD50ToD65(d50)));
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/** Reads a number, a percentage (scaled by `percentScale` for 100%) or `none` */
function readNumber(token: string, percentScale = 1): number | null {
  if (token === "none") return 0;
  const percent = token.endsWith("%");
  const value = Number(percent ? token.slice(0, -1) : token);
  if (!Number.isFinite(value)) return null;
  return percent ? (value / 100) * percentScale : value;
}

/** Reads an angle in degrees (deg, rad, grad, turn, or a bare number) */
function readAngle(token: string): number | null {
  if (token === "none") return 0;
  const match = token.match(/^([-+]?[\d.]+(?:e[-+]?\d+)?)(deg|rad|grad|turn)?$/);
  if (!match) return null;
  const value = Number(match[1]);
  const factor = { deg: 1, rad: 180 / Math.PI, grad: 0.9, turn: 360 }[match[2] ?? "deg"] ?? 1;
  return Number.isFinite(value) ? value * factor : null;
}

/** HSL (h in degrees, s and l in 0–1) → gamma-encoded sRGB */
function hslToSrgb(h: number, s: number, l: number): Rgb {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parseHex(hex: string): Oklab | null {
  if (!/^[0-9a-f]+$/.test(hex) || ![3, 4, 6, 8].includes(hex.length)) return null;
  const full = hex.length <= 4 ? [...hex].map((ch) => ch + ch).join("") : hex;
  const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as Rgb;
  return srgbToOklab(rgb);
}

function parseFunction(name: string, args: string[]): Oklab | null {
  const [t0, t1, t2, t3] = args;

  switch (name) {
    case "rgb":
    case "rgba": {
      const rgb = [t0, t1, t2].map((t) => readNumber(t, 255));
      if (rgb.some((v) => v === null)) return null;
      return srgbToOklab(rgb.map((v) => v! / 255) as Rgb);
    }
    case "hsl":
    case "hsla":
    case "hwb": {
      const h = readAngle(t0);
      const x = readNumber(t1, 100);
      const y = readNumber(t2, 100);
      if (h === null || x === null || y === null) return null;
      if (name === "hwb") {
        const [w, b] = [x / 100, y / 100];
        if (w + b >= 1) {
          const grey = w / (w + b);
          return srgbToOklab([grey, grey, grey]);
        }
        const pure = hslToSrgb(((h % 360) + 360) % 360, 1, 0.5);
        return srgbToOklab(pure.map((v) => v * (1 - w - b) + w) as Rgb);
      }
      return srgbToOklab(hslToSrgb(((h % 360) + 360) % 360, x / 100, y / 100));
    }
    case "oklab": {
      const L = readNumber(t0);
      const a = readNumber(t1, 0.4);
      const b = readNumber(t2, 0.4);
      if (L === null || a === null || b === null) return null;
      return [L, a, b];
    }
    case "oklch": {
      const L = readNumber(t0);
      const C = readNumber(t1, 0.4);
      const H = readAngle(t2);
      if (L === null || C === null || H === null) return null;
      return oklchToOklab(L, C, H);
    }
    case "lab": {
      const L = readNumber(t0, 100);
      const a = readNumber(t1, 125);
      const b = readNumber(t2, 125);
      if (L === null || a === null || b === null) return null;
      return cieLabToOklab(L, a, b);
    }
    case "lch": {
      const L = readNumber(t0, 100);
      const C = readNumber(t1, 150);
      const H = readAngle(t2);
      if (L === null || C === null || H === null) return null;
      const rad = (H * Math.PI) / 180;
      return cieLabToOklab(L, C * Math.cos(rad), C * Math.sin(rad));
    }
    case "color": {
      const values = [t1, t2, t3].map((t) => (t === undefined ? null : readNumber(t)));
      if (values.some((v) => v === null)) return null;
      const rgb = values as Rgb;
      switch (t0) {
        case "srgb":
          return srgbToOklab(rgb);
        case "srgb-linear":
          return linearSrgbToOklab(rgb);
        case "display-p3":
          return linearSrgbToOklab(linearP3ToLinearSrgb(rgb.map(decodeGamma) as Rgb));
        case "xyz":
        case "xyz-d65":
          return linearSrgbToOklab(xyzD65ToLinearSrgb(rgb));
        case "xyz-d50":
          return linearSrgbToOklab(xyzD65ToLinearSrgb(xyzD50ToD65(rgb)));
        default:
          return null;
      }
    }
    default:
      return null;
  }
}

/** Parses the CSS color syntaxes known in JS (no browser needed) */
export function parseCssColor(css: string): Oklab | null {
  const color = css.trim().toLowerCase();

  if (color.startsWith("#")) return parseHex(color.slice(1));
  if (NAMED_COLORS[color]) return parseHex(NAMED_COLORS[color]);

  const match = color.match(/^([a-z-]+)\(([^()]*)\)$/);
  if (!match) return null;
  const args = match[2].replace(/[,/]/g, " ").trim().split(/\s+/);
  return parseFunction(match[1], args);
}

// ---------------------------------------------------------------------------
// Browser fallback
// ---------------------------------------------------------------------------

let probe: HTMLElement | null = null;

/** Lets the browser compute the color, then parses its serialization */
function resolveInBrowser(css: string): Oklab | null {
  try {
    if (typeof document !== "undefined" && document.documentElement) {
      probe ??= document.createElement("span");
      probe.style.color = "";
      probe.style.color = css;
      if (!probe.style.color) return null; // invalid color
      document.documentElement.appendChild(probe);
      const computed = getComputedStyle(probe).color;
      probe.remove();
      return parseCssColor(computed);
    }
    if (typeof OffscreenCanvas !== "undefined") {
      const ctx = new OffscreenCanvas(1, 1).getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#010203";
      ctx.fillStyle = css;
      const value = String(ctx.fillStyle);
      return value === "#010203" ? null : parseCssColor(value);
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * Reads any CSS color as OKLab.
 *
 * Returns `null` if the color cannot be read (unknown syntax outside a
 * browser, `var()` without a document, invalid color…).
 */
export function readColor(css: string): Oklab | null {
  return parseCssColor(css) ?? resolveInBrowser(css);
}
