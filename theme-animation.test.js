import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Task 10.3 — theme and animation tests.
// jsdom does not do layout or paint, so the theme and animations are verified
// by asserting against the real CSS text and the real HTML markup read from
// disk (the approach the design's Testing Strategy calls for). We parse the CSS
// for tokens, @keyframes blocks, and the prefers-reduced-motion block, and we
// parse index.html for the decorative SVG/emoji markup.
// _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.3, 8.4, 8.5, 9.2_
//
// Note: 30fps (Req 8.2) is verified by manual/visual check on the target
// display, not automated here (headless fps measurement is unreliable).

// Read the real theme/markup from disk. Under Vitest's jsdom environment
// `import.meta.url` is not a file:// URL, so resolve against the project root
// (Vitest runs from the package directory) instead.
const css = readFileSync(join(process.cwd(), "styles.css"), "utf8");
const html = readFileSync(join(process.cwd(), "index.html"), "utf8");

// ---- CSS parsing helpers ---------------------------------------------------

// Read the body between a matched `{` and its balancing `}` starting at
// `openIndex` (the index of the `{`).
function balancedBody(source, openIndex) {
  let depth = 1;
  for (let i = openIndex + 1; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return null;
}

// All rule bodies whose selector list matches `selectorPattern`. A plain
// selector like `.deco-star` can appear in several rules; return every body so
// callers can find the one carrying the declaration they care about.
function ruleBodies(source, selectorPattern) {
  const re = new RegExp(selectorPattern.source + "[^{}]*\\{", "g" + selectorPattern.flags.replace("g", ""));
  const bodies = [];
  let m;
  while ((m = re.exec(source)) !== null) {
    const openIndex = m.index + m[0].length - 1;
    const body = balancedBody(source, openIndex);
    if (body !== null) bodies.push(body);
  }
  return bodies;
}

// Convenience: the first matching rule body (or null).
function ruleBody(source, selectorPattern) {
  const bodies = ruleBodies(source, selectorPattern);
  return bodies.length ? bodies[0] : null;
}

// Extract a @keyframes block body by name (the text between its braces,
// including the inner percentage-step blocks).
function keyframesBody(source, name) {
  const re = new RegExp("@keyframes\\s+" + name + "\\s*\\{");
  const m = re.exec(source);
  if (!m) return null;
  const start = m.index + m[0].length;
  let depth = 1;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i);
    }
  }
  return null;
}

// Extract the @media (prefers-reduced-motion: reduce) block body.
function reducedMotionBody(source) {
  const re = /@media\s*\([^)]*prefers-reduced-motion\s*:\s*reduce[^)]*\)\s*\{/;
  const m = re.exec(source);
  if (!m) return null;
  const start = m.index + m[0].length;
  let depth = 1;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i);
    }
  }
  return null;
}

// ---- WCAG contrast helpers -------------------------------------------------

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// Relative luminance per WCAG 2.x definition.
function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Contrast ratio per WCAG 2.x: (L_lighter + 0.05) / (L_darker + 0.05).
function contrastRatio(hexA, hexB) {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---- Palette (from :root tokens) -------------------------------------------

const BG = "#0d0d0d";
const TITLE = "#b5e847";
const PINK = "#f4a6c8";
const ORANGE = "#f08a24";
const CREAM = "#f5f0e6";

describe("theme (Req 7.1–7.6, 9.2)", () => {
  it("sets --bg to #0d0d0d and paints html/body with it (Req 7.1)", () => {
    // Token defined.
    expect(css).toMatch(/--bg\s*:\s*#0d0d0d\b/i);
    // html/body use the token for background and cover the viewport.
    const htmlBodyBlocks = css.match(/html\s*,\s*body\s*\{[^}]*\}/gi) || [];
    const joined = htmlBodyBlocks.join("\n");
    expect(joined).toMatch(/background\s*:\s*var\(\s*--bg\s*\)/i);
    expect(joined).toMatch(/min-height\s*:\s*100vh/i);
  });

  it("styles the title with --title, Pirata One + serif fallback (Req 7.2, 7.3)", () => {
    // Token value.
    expect(css).toMatch(/--title\s*:\s*#b5e847\b/i);

    // `.title` appears in more than one rule (e.g. a grouped z-index rule and
    // its own styling rule); find the one that styles color + font.
    const titleBodies = ruleBodies(css, /\.title(?![-\w])/);
    expect(titleBodies.length).toBeGreaterThan(0);
    const title = titleBodies.find((b) => /font-family\s*:/i.test(b));
    expect(title).toBeTruthy();

    // Color uses the token (or the literal green as a documented fallback).
    expect(title).toMatch(/color\s*:\s*(var\(\s*--title\s*\)|#b5e847)/i);

    // Blackletter display face is loaded (via @import here; a <link> would also
    // satisfy — check both sources).
    const pirataLoaded =
      /@import[^;]*Pirata\+?One/i.test(css) ||
      /Pirata\+?One/i.test(html);
    expect(pirataLoaded).toBe(true);

    // font-family names Pirata One and the stack ends in serif.
    const fontFamily = /font-family\s*:\s*([^;]+);/i.exec(title);
    expect(fontFamily).toBeTruthy();
    const stack = fontFamily[1];
    expect(stack).toMatch(/["']?Pirata One["']?/i);
    expect(stack.trim()).toMatch(/serif\s*$/i);
  });

  it("defines and uses each accent color at least once (Req 7.4)", () => {
    // Tokens defined with the required values.
    expect(css).toMatch(/--accent-pink\s*:\s*#f4a6c8\b/i);
    expect(css).toMatch(/--accent-orange\s*:\s*#f08a24\b/i);
    expect(css).toMatch(/--accent-cream\s*:\s*#f5f0e6\b/i);

    // Each accent is referenced via var() somewhere beyond its own declaration.
    // Count occurrences of var(--accent-*): more than the single :root use.
    const pinkUses = (css.match(/var\(\s*--accent-pink\s*\)/gi) || []).length;
    const orangeUses = (css.match(/var\(\s*--accent-orange\s*\)/gi) || []).length;
    const creamUses = (css.match(/var\(\s*--accent-cream\s*\)/gi) || []).length;
    expect(pinkUses).toBeGreaterThanOrEqual(1);
    expect(orangeUses).toBeGreaterThanOrEqual(1);
    expect(creamUses).toBeGreaterThanOrEqual(1);
  });

  it("renders >=8 inline SVG icons in an aria-hidden decorations layer with emoji fallback (Req 7.5, 8.5)", () => {
    // The decorations layer exists and is aria-hidden.
    const decoMatch = html.match(
      /<div class="decorations"[^>]*>([\s\S]*?)<\/div>\s*<h1/i
    );
    expect(decoMatch).toBeTruthy();
    const decoLayerTag = /<div class="decorations"[^>]*>/i.exec(html)[0];
    expect(decoLayerTag).toMatch(/aria-hidden\s*=\s*"true"/i);

    const decoInner = decoMatch[1];
    const svgCount = (decoInner.match(/<svg\b/gi) || []).length;
    expect(svgCount).toBeGreaterThanOrEqual(8);

    // Emoji fallback spans exist for icons.
    const emojiCount = (decoInner.match(/class="icon-emoji"/gi) || []).length;
    expect(emojiCount).toBeGreaterThanOrEqual(8);
  });

  it("meets WCAG contrast on #0d0d0d: body cream >=4.5:1, title/large accents >=3:1 (Req 7.6, 9.2)", () => {
    // Body/score text is cream on the dark background — normal-text threshold.
    expect(contrastRatio(CREAM, BG)).toBeGreaterThanOrEqual(4.5);

    // Title (neon green) is large text — 3:1 threshold.
    expect(contrastRatio(TITLE, BG)).toBeGreaterThanOrEqual(3);

    // Large-text accents (used on large labels/matchup text).
    expect(contrastRatio(PINK, BG)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(ORANGE, BG)).toBeGreaterThanOrEqual(3);
  });
});

describe("ambient animations (Req 8.1, 8.3, 8.4)", () => {
  const candleKf = keyframesBody(css, "deco-candle-flicker");
  const spiderKf = keyframesBody(css, "deco-spider-drift");
  const starKf = keyframesBody(css, "deco-star-twinkle");

  it("defines candle flicker, spider drift, and star twinkle keyframes wired to the deco elements (Req 8.1)", () => {
    expect(candleKf).toBeTruthy();
    expect(spiderKf).toBeTruthy();
    expect(starKf).toBeTruthy();

    // Each keyframe set is applied to its decorative element. A selector may
    // appear in several rules (placement vs. animation), so check that SOME
    // matching rule wires the animation.
    const flameBodies = ruleBodies(css, /\.deco-candle-flame/);
    const spiderBodies = ruleBodies(css, /\.deco-spider(?![-\w])/);
    const starBodies = ruleBodies(css, /\.deco-star(?![-\w])/);
    expect(flameBodies.some((b) => /animation\s*:\s*deco-candle-flicker/i.test(b))).toBe(true);
    expect(spiderBodies.some((b) => /animation\s*:\s*deco-spider-drift/i.test(b))).toBe(true);
    expect(starBodies.some((b) => /animation\s*:\s*deco-star-twinkle/i.test(b))).toBe(true);
  });

  it("animates only transform/opacity — no layout properties in keyframes (Req 8.3)", () => {
    const forbidden = /\b(top|left|right|bottom|width|height|margin|padding)\s*:/i;
    for (const kf of [candleKf, spiderKf, starKf]) {
      expect(kf).toBeTruthy();
      // Each declaration inside must be transform or opacity only.
      expect(forbidden.test(kf)).toBe(false);
      // And it must actually use transform and/or opacity.
      expect(/(transform|opacity)\s*:/i.test(kf)).toBe(true);
    }
  });

  it("keeps spider displacement well under 15vw/15vh per cycle (Req 8.4)", () => {
    // Pull every vw/vh/px displacement magnitude out of the spider keyframes.
    const units = spiderKf.match(/-?\d*\.?\d+\s*(vw|vh|px)/gi) || [];
    expect(units.length).toBeGreaterThan(0);

    let maxVw = 0;
    let maxVh = 0;
    for (const u of units) {
      const value = Math.abs(parseFloat(u));
      if (/vw$/i.test(u)) maxVw = Math.max(maxVw, value);
      else if (/vh$/i.test(u)) maxVh = Math.max(maxVh, value);
      // px values are tiny sub-pixel flame nudges elsewhere; spider uses vw/vh.
    }
    expect(maxVw).toBeLessThanOrEqual(15);
    expect(maxVh).toBeLessThanOrEqual(15);
  });

  it("never targets the grid, cells, totals, or title with animation (Req 8.3)", () => {
    // No @keyframes should be named after scoreboard selectors, and none of the
    // scoreboard rules should declare an `animation`.
    const scoreboardSelectors = [
      /#score-grid/,
      /\.grid-table/,
      /\.score-cell(?![-\w])/,
      /\.team-total/,
      /\.total-label/,
      /\.team-name-input/,
      /\.title(?![-\w])/,
    ];
    for (const sel of scoreboardSelectors) {
      for (const body of ruleBodies(css, sel)) {
        expect(/\banimation\s*:/i.test(body)).toBe(false);
      }
    }
  });

  it("disables ambient animation under prefers-reduced-motion (Req 8.3 pref)", () => {
    const rm = reducedMotionBody(css);
    expect(rm).toBeTruthy();
    // Targets the deco animation elements and sets animation: none.
    expect(rm).toMatch(/\.deco-candle-flame/);
    expect(rm).toMatch(/\.deco-spider/);
    expect(rm).toMatch(/\.deco-star/);
    expect(rm).toMatch(/animation\s*:\s*none/i);
  });
});

describe("failed decoration handling (Req 8.5)", () => {
  it("provides an emoji fallback so a missing/failed SVG falls back to emoji without breaking layout", () => {
    // A rule reveals .icon-emoji when the SVG is absent (icon with no .icon-svg).
    // The impl uses :has()/absence-of-svg to show the emoji; assert the emoji
    // fallback CSS exists and can display when the svg is not present.
    expect(css).toMatch(/\.icon-emoji/);
    // Emoji hidden by default (shown only as a fallback): some .icon-emoji rule
    // sets display:none.
    const emojiBodies = ruleBodies(css, /\.icon-emoji/);
    expect(emojiBodies.some((b) => /display\s*:\s*none/i.test(b))).toBe(true);
    // A fallback selector shows the emoji when the svg is missing (icon with no
    // .icon-svg), so a failed decoration falls back to emoji rather than
    // breaking the layout.
    expect(css).toMatch(/\.icon:not\(:has\(\.icon-svg\)\)\s*\.icon-emoji\s*\{\s*display\s*:\s*block/i);
  });
});

describe("matchup overlay theme (Req 9.1, 12.6)", () => {
  it("renders #matchup-content in the neon-green title token at a large room-readable clamp() size", () => {
    // #matchup-content shares a rule with .matchup-content; find the body that
    // carries the font-size + color.
    const bodies = ruleBodies(css, /#matchup-content/);
    expect(bodies.length).toBeGreaterThan(0);
    const content = bodies.find((b) => /font-size\s*:/i.test(b));
    expect(content).toBeTruthy();

    // Content color is the neon-green title token.
    expect(content).toMatch(/color\s*:\s*var\(\s*--title\s*\)/i);

    // Font-size is a clamp() whose max is very large (much bigger than 24px)
    // so the matchup reads across a room.
    const fs = /font-size\s*:\s*clamp\(([^)]+)\)/i.exec(content);
    expect(fs).toBeTruthy();
    const args = fs[1].split(",").map((s) => s.trim());
    expect(args.length).toBe(3);
    // Max term (third arg) resolves to px via rem (16px base).
    const maxRem = /^(-?[\d.]+)rem$/.exec(args[2]);
    expect(maxRem).toBeTruthy();
    const maxPx = parseFloat(maxRem[1]) * 16;
    expect(maxPx).toBeGreaterThanOrEqual(24);
    // "much larger" — the overlay headline dwarfs the 24px floor.
    expect(maxPx).toBeGreaterThanOrEqual(48);
  });

  it("hides the overlay when [hidden] is set on #matchup-overlay", () => {
    // A rule must force the overlay off (display:none) under the [hidden]
    // attribute so it beats the display:flex layout rule.
    expect(css).toMatch(
      /#matchup-overlay\[hidden\][^{]*\{[^}]*display\s*:\s*none/i
    );
  });
});
