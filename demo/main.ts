import {
  sequential,
  divergent,
  divergentSequential,
  categorical,
  categoricalPatterns,
  sequentialPatterns,
  resolvePalette,
  presets,
  temperature,
} from "../src/index";
import { motif } from "@ateliercartographie/motif.js";

import type { ContrastMode, CategoricalColorOptions, Range } from "../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function $(id: string) {
  return document.getElementById(id)!;
}

function parseRange(value: string): Range {
  const parts = value.split(",").map((s) => parseFloat(s.trim()));
  return [parts[0] ?? 0, parts[1] ?? 360];
}

function renderPalette(container: HTMLElement, colors: string[]) {
  const resolved = resolvePalette(colors, { format: "css" });
  container.innerHTML = resolved
    .map(
      (c, i) =>
        `<div class="swatch" style="background:${colors[i]}"><span class="tooltip">${c}</span></div>`
    )
    .join("");
}

function createPatternPreview(pattern: {
  type: string;
  angle: number;
  scale: number;
  size: number;
  fill: string;
  background: string;
  patchSize: boolean;
}): SVGSVGElement {
  const rendered = motif(pattern);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 120 120");
  svg.setAttribute("class", "pattern-preview");
  svg.setAttribute("aria-label", `Motif ${pattern.type}`);

  svg.appendChild(rendered.defs.cloneNode(true));

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", "120");
  rect.setAttribute("height", "120");
  rect.setAttribute("fill", rendered.url);
  svg.appendChild(rect);

  return svg;
}

function renderPatternCards(
  container: HTMLElement,
  patterns: {
    type: string;
    angle: number;
    scale: number;
    size: number;
    fill: string;
    background: string;
    patchSize: boolean;
  }[]
) {
  container.innerHTML = "";

  patterns.forEach((pattern, index) => {
    const card = document.createElement("div");
    card.className = "pattern-card";

    const title = document.createElement("strong");
    title.textContent = `#${index + 1} — ${pattern.type}`;

    const preview = createPatternPreview(pattern);

    const meta = document.createElement("div");
    meta.className = "pattern-meta";
      meta.innerHTML = `angle: ${pattern.angle}°<br/>scale: ${pattern.scale}<br/>size: ${pattern.size}<br/>fill: ${pattern.fill}`;

    card.append(title, preview, meta);
    container.appendChild(card);
  });
}

// ---------------------------------------------------------------------------
// Séquentielle
// ---------------------------------------------------------------------------

function updateSequential() {
  const colorStart =
    ($("seq-color-start-text") as HTMLInputElement).value ||
    ($("seq-color-start") as HTMLInputElement).value;

  const endText = ($("seq-color-end-text") as HTMLInputElement).value;
  const colorEnd = endText || undefined;

  const steps = parseInt(($("seq-steps") as HTMLInputElement).value, 10) || 5;
  const contrast = ($("seq-contrast") as HTMLSelectElement).value as ContrastMode;

  const palette = sequential({ colorStart, colorEnd, steps, contrast });
  renderPalette($("seq-palette"), palette);

  const resolved = resolvePalette(palette, { format: "css" });
  const webgl = resolvePalette(palette, { format: "webgl" });

  ($("seq-output") as HTMLPreElement).textContent = JSON.stringify(
    { css: resolved, webgl },
    null,
    2
  );
}

// Synchroniser color picker ↔ text
$("seq-color-start").addEventListener("input", (e) => {
  ($("seq-color-start-text") as HTMLInputElement).value = (e.target as HTMLInputElement).value;
  updateSequential();
});
$("seq-color-start-text").addEventListener("input", (e) => {
  // Tenter de mettre à jour le color picker si la valeur est un hex valide
  const val = (e.target as HTMLInputElement).value;
  if (/^#[0-9a-f]{6}$/i.test(val)) {
    ($("seq-color-start") as HTMLInputElement).value = val;
  }
  updateSequential();
});
$("seq-color-end").addEventListener("input", (e) => {
  ($("seq-color-end-text") as HTMLInputElement).value = (e.target as HTMLInputElement).value;
  updateSequential();
});
$("seq-color-end-text").addEventListener("input", (e) => {
  const val = (e.target as HTMLInputElement).value;
  if (/^#[0-9a-f]{6}$/i.test(val)) {
    ($("seq-color-end") as HTMLInputElement).value = val;
  }
  updateSequential();
});
$("seq-steps").addEventListener("input", updateSequential);
$("seq-contrast").addEventListener("change", updateSequential);

// ---------------------------------------------------------------------------
// Divergente
// ---------------------------------------------------------------------------

function updateDivergent() {
  const colorA =
    ($("div-color-a-text") as HTMLInputElement).value ||
    ($("div-color-a") as HTMLInputElement).value;

  const bText = ($("div-color-b-text") as HTMLInputElement).value;
  const colorB = bText || undefined;

  const leftSteps = parseInt(($("div-steps-left") as HTMLInputElement).value, 10) || 3;
  const rightSteps = parseInt(($("div-steps-right") as HTMLInputElement).value, 10) || 3;
  const contrast = ($("div-contrast") as HTMLSelectElement).value as ContrastMode;
  const hasCenterClass = ($("div-center-class") as HTMLInputElement).checked;

  const baseOptions = { colorA, colorB, steps: [leftSteps, rightSteps] as [number, number], contrast, hasCenterClass };

  const paletteOklab = divergent({ ...baseOptions, colorSpace: "oklab" });
  const paletteOklch = divergent({ ...baseOptions, colorSpace: "oklch" });
  const paletteSeq = divergentSequential(baseOptions);

  renderPalette($("div-palette-oklab"), paletteOklab);
  renderPalette($("div-palette-oklch"), paletteOklch);
  renderPalette($("div-palette-seq"), paletteSeq);

  const resolvedOklab = resolvePalette(paletteOklab, { format: "css" });
  const resolvedOklch = resolvePalette(paletteOklch, { format: "css" });
  const resolvedSeq = resolvePalette(paletteSeq, { format: "css" });

  ($("div-output") as HTMLPreElement).textContent = JSON.stringify(
    { oklab: resolvedOklab, oklch: resolvedOklch, sequentiel: resolvedSeq },
    null,
    2
  );
}

// Synchroniser color picker ↔ text
$("div-color-a").addEventListener("input", (e) => {
  ($("div-color-a-text") as HTMLInputElement).value = (e.target as HTMLInputElement).value;
  updateDivergent();
});
$("div-color-a-text").addEventListener("input", (e) => {
  const val = (e.target as HTMLInputElement).value;
  if (/^#[0-9a-f]{6}$/i.test(val)) {
    ($("div-color-a") as HTMLInputElement).value = val;
  }
  updateDivergent();
});
$("div-color-b").addEventListener("input", (e) => {
  ($("div-color-b-text") as HTMLInputElement).value = (e.target as HTMLInputElement).value;
  updateDivergent();
});
$("div-color-b-text").addEventListener("input", (e) => {
  const val = (e.target as HTMLInputElement).value;
  if (/^#[0-9a-f]{6}$/i.test(val)) {
    ($("div-color-b") as HTMLInputElement).value = val;
  }
  updateDivergent();
});
$("div-steps-left").addEventListener("input", updateDivergent);
$("div-steps-right").addEventListener("input", updateDivergent);
$("div-contrast").addEventListener("change", updateDivergent);
$("div-center-class").addEventListener("change", updateDivergent);

// ---------------------------------------------------------------------------
// Catégorielle
// ---------------------------------------------------------------------------

function getCategoricalOptions(): CategoricalColorOptions {
  const presetName = ($("cat-preset") as HTMLSelectElement).value;
  const tempName = ($("cat-temperature") as HTMLSelectElement).value;

  if (presetName !== "custom") {
    const base = presets[presetName as keyof typeof presets] ?? presets.vif;
    const temp = tempName !== "none" ? temperature[tempName as keyof typeof temperature] : {};
    return { ...base, ...temp };
  }

  // Custom
  const options: CategoricalColorOptions = {
    hueRange: parseRange(($("cat-hue") as HTMLInputElement).value),
    chromaRange: parseRange(($("cat-chroma") as HTMLInputElement).value),
    lightnessRange: parseRange(($("cat-light") as HTMLInputElement).value),
  };

  if (tempName !== "none") {
    Object.assign(options, temperature[tempName as keyof typeof temperature]);
  }

  return options;
}

function updateCategorical() {
  const count = parseInt(($("cat-count") as HTMLInputElement).value, 10) || 8;
  const options = getCategoricalOptions();
  const palette = categorical(count, options);

  renderPalette($("cat-palette"), palette);

  const resolved = resolvePalette(palette, { format: "css" });
  ($("cat-output") as HTMLPreElement).textContent = JSON.stringify(resolved, null, 2);

  // Mettre à jour les champs custom avec les valeurs du preset actif
  const preset = ($("cat-preset") as HTMLSelectElement).value;
  if (preset !== "custom") {
    const base = presets[preset as keyof typeof presets] ?? presets.vif;
    ($("cat-hue") as HTMLInputElement).value = (options.hueRange ?? base.hueRange ?? [0, 360]).join(", ");
    ($("cat-chroma") as HTMLInputElement).value = (options.chromaRange ?? base.chromaRange ?? [0.15, 0.25]).join(", ");
    ($("cat-light") as HTMLInputElement).value = (options.lightnessRange ?? base.lightnessRange ?? [0.5, 0.75]).join(", ");
  }
}

$("cat-count").addEventListener("input", updateCategorical);
$("cat-preset").addEventListener("change", updateCategorical);
$("cat-temperature").addEventListener("change", updateCategorical);
$("cat-hue").addEventListener("input", () => {
  ($("cat-preset") as HTMLSelectElement).value = "custom";
  updateCategorical();
});
$("cat-chroma").addEventListener("input", () => {
  ($("cat-preset") as HTMLSelectElement).value = "custom";
  updateCategorical();
});
$("cat-light").addEventListener("input", () => {
  ($("cat-preset") as HTMLSelectElement).value = "custom";
  updateCategorical();
});

// ---------------------------------------------------------------------------
// Motifs
// ---------------------------------------------------------------------------

function updatePatterns() {
  const count = parseInt(($("pat-count") as HTMLInputElement).value, 10) || 6;
  const shapes = ($("pat-shapes") as HTMLInputElement).value.split(",").map((s) => s.trim()).filter(Boolean);
  const angleRange = parseRange(($("pat-angles") as HTMLInputElement).value);
  const scaleRange = parseRange(($("pat-scales") as HTMLInputElement).value);
    const colorize = ($("pat-colorize") as HTMLSelectElement).value === "on";

    const patterns = categoricalPatterns(count, { shapes, angleRange, scaleRange, colorize });

  renderPatternCards($("pat-grid"), patterns);

  ($("pat-output") as HTMLPreElement).textContent = JSON.stringify(patterns, null, 2);
}

$("pat-count").addEventListener("input", updatePatterns);
$("pat-shapes").addEventListener("input", updatePatterns);
$("pat-angles").addEventListener("input", updatePatterns);
$("pat-scales").addEventListener("input", updatePatterns);
$("pat-colorize").addEventListener("change", updatePatterns);

// ---------------------------------------------------------------------------
// Motifs séquentiels
// ---------------------------------------------------------------------------

function updateSeqPatterns() {
  const count = parseInt(($("spat-count") as HTMLInputElement).value, 10) || 5;
  const shape = ($("spat-shape") as HTMLSelectElement).value;
  const contrast = ($("spat-contrast") as HTMLSelectElement).value as ContrastMode;
  const sizeRange = parseRange(($("spat-sizes") as HTMLInputElement).value);

  const patterns = sequentialPatterns(count, { shape, contrast, sizeRange });

  renderPatternCards($("spat-grid"), patterns);

  ($("spat-output") as HTMLPreElement).textContent = JSON.stringify(patterns, null, 2);
}

$("spat-count").addEventListener("input", updateSeqPatterns);
$("spat-shape").addEventListener("change", updateSeqPatterns);
$("spat-contrast").addEventListener("change", updateSeqPatterns);
$("spat-sizes").addEventListener("input", updateSeqPatterns);

// ---------------------------------------------------------------------------
// Thème
// ---------------------------------------------------------------------------

type ThemeMode = "dark" | "light";

function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("demo-theme", theme);
}

function initTheme() {
  const stored = localStorage.getItem("demo-theme");
  const theme: ThemeMode = stored === "light" ? "light" : "dark";
  const select = $("theme-select") as HTMLSelectElement;
  select.value = theme;
  applyTheme(theme);
  select.addEventListener("change", () => {
    applyTheme(select.value === "light" ? "light" : "dark");
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

initTheme();
updateSequential();
updateDivergent();
updateCategorical();
updatePatterns();
updateSeqPatterns();
