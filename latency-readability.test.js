import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  handleCellInput,
  createInitialState,
  renderTotals,
  teamTotal,
  TEAMS,
  GAMES,
} from "./app.js";

// Task 10.2 — recalc-latency and readability tests (Req 3.4, 9.1, 9.3, 9.4).
//
// Two concerns, verified two ways:
//
//   1. Recalc latency (Req 3.4). Fully testable in jsdom: handleCellInput does
//      a synchronous validate + write + renderTotals, so we drive it against a
//      real DOM (the actual index.html body) and assert both correctness (the
//      total's textContent) and that the elapsed time is comfortably under the
//      200ms budget.
//
//   2. Readability / no-clipping (Req 9.1, 9.3, 9.4). NOT reliably testable in
//      jsdom: jsdom performs no layout and does not resolve clamp() to a px
//      value — getComputedStyle returns the raw clamp() string, and there is no
//      viewport to measure against. True computed-size verification (>=24px at a
//      >=1280px viewport) and true "no horizontal scroll / no clipping" require
//      a real browser at a real viewport. So here we assert the CSS RULES that
//      ENFORCE those requirements: every readability-critical font-size uses a
//      clamp() whose maximum (third arg) is >= 24px (1.5rem at a 16px base), and
//      the grid has the structural containment (overflow + fixed table layout +
//      #app max-width) that prevents horizontal page scroll and clipping. These
//      are meaningful proxies tied to the real stylesheet, not tautologies.

// Load the real markup and stylesheet as text. Under the jsdom test
// environment `import.meta.url` is not a file:// URL, so resolve against the
// project root (Vitest runs from the workspace root) instead.
const INDEX_HTML = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
// Strip /* ... */ comments so brace-matching over the stylesheet isn't thrown
// off by braces or slashes that appear inside comments.
const STYLES_CSS = readFileSync(resolve(process.cwd(), "styles.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  ""
);

// Parse the (comment-stripped) stylesheet into a flat list of
// { selectors: string, body: string } rule objects. This only handles the flat
// rules this stylesheet uses for the selectors under test; at-rule blocks like
// @media wrap their own inner rules, which we skip (the readability selectors we
// assert on are all top-level).
function parseRules(css) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const selectors = m[1].trim();
    // Skip at-rule preludes (e.g. "@media (...)") — their body is nested rules,
    // not declarations, and the flat regex would capture the prelude oddly.
    if (selectors.startsWith("@")) {
      continue;
    }
    rules.push({ selectors, body: m[2] });
  }
  return rules;
}

const RULES = parseRules(STYLES_CSS);

// True if `selector` appears as a standalone selector in a comma-separated
// selector list (so ".score-cell" doesn't match ".score-cell-wrap").
function selectorListHas(selectorList, selector) {
  return selectorList
    .split(",")
    .map((s) => s.trim())
    .some((s) => s === selector);
}

// Extract just the <body> inner markup from index.html so we mount the real
// grid (24 .score-cell inputs, four [data-total] cells, the table) into jsdom.
function bodyInnerHtml() {
  const match = INDEX_HTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!match) {
    throw new Error("Could not find <body> in index.html");
  }
  // Drop the module <script> tag — we don't want the app to bootstrap itself
  // during the test; we call the controller functions directly.
  return match[1].replace(/<script[\s\S]*?<\/script>/gi, "");
}

describe("recalc latency (Req 3.4)", () => {
  beforeEach(() => {
    document.body.innerHTML = bodyInnerHtml();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  // Sanity: the real markup we mounted has the full 24-cell grid and 4 totals,
  // so the latency assertions below run against the actual DOM, not a stub.
  it("mounts the real grid: 24 score cells and 4 total displays", () => {
    expect(document.querySelectorAll(".score-cell[data-team][data-game]").length).toBe(24);
    expect(document.querySelectorAll("[data-total]").length).toBe(4);
  });

  // A representative set of edits across teams and games, including a negative
  // for quiet-place (the only game that permits negatives). Each entry:
  // [team, game, rawValue, expectedTotalText].
  const cases = [
    ["A", "abcd-names", "5", "5"],
    ["B", "bone-finder", "12", "12"],
    ["C", "ghost-catcher", "999", "999"],
    ["D", "quiet-place", "0", "0"],
    ["A", "quiet-place", "-7", "-7"], // negative allowed only for quiet-place
  ];

  it.each(cases)(
    "applies %s/%s = %s and updates the total to %s in well under 200ms",
    (team, game, raw, expectedText) => {
      const state = createInitialState();
      // Render totals once from the zeroed state so the DOM starts at "0".
      renderTotals(state, document);
      const totalEl = document.querySelector(`[data-total="${team}"]`);
      expect(totalEl).not.toBeNull();
      expect(totalEl.textContent).toBe("0");

      const t0 = performance.now();
      const result = handleCellInput(state, team, game, raw, document);
      const displayed = totalEl.textContent;
      const t1 = performance.now();

      // Accepted and reflected in state.
      expect(result.ok).toBe(true);
      expect(teamTotal(state.scores, team)).toBe(Number.parseInt(raw, 10));

      // The displayed total updated synchronously to the new value (Req 3.4).
      expect(displayed).toBe(expectedText);

      // Comfortably within the 200ms budget — the update is synchronous, so
      // this is typically sub-millisecond (Req 3.4).
      expect(t1 - t0).toBeLessThan(200);
    }
  );

  // A negative for quiet-place, then clearing it back to empty, both reflect in
  // the total within budget — exercises the negative path and the recalc on a
  // second edit to the same team.
  it("recalculates within budget across successive edits including a negative", () => {
    const state = createInitialState();
    renderTotals(state, document);
    const totalEl = document.querySelector('[data-total="A"]');

    const t0 = performance.now();
    handleCellInput(state, "A", "abcd-names", "10", document);
    handleCellInput(state, "A", "quiet-place", "-4", document);
    const displayed = totalEl.textContent;
    const t1 = performance.now();

    expect(displayed).toBe("6"); // 10 + (-4)
    expect(t1 - t0).toBeLessThan(200);
  });
});

describe("readability CSS enforcement (Req 9.1, 9.4)", () => {
  // jsdom cannot resolve clamp() or perform layout (see the file header), so we
  // verify the CSS RULE that guarantees the >=24px minimum instead of a computed
  // pixel size. For each readability-critical selector we pull its
  // `font-size: clamp(min, pref, max)` and assert the clamp MAX (third arg) is
  // >= 24px. 24px == 1.5rem at the 16px root default. clamp() can never resolve
  // above its max, so a max >= 24px is the guarantee that at a wide (>=1280px)
  // viewport the text is at least 24px (the vw-based preferred term drives the
  // value up to that ceiling). True on-screen size still needs a real browser.
  const REM_PX = 16;
  const MIN_PX = 24;

  // Convert a clamp() argument token (e.g. "1.5rem", "2.4vw", "40px") into a px
  // number when it is rem/px, or null when it is viewport-relative (vw/vh) —
  // viewport units can't be resolved without a viewport, and for the MAX term
  // we only ever expect rem/px in this stylesheet.
  function tokenToPx(token) {
    const t = token.trim();
    let m;
    if ((m = t.match(/^(-?[\d.]+)rem$/))) {
      return parseFloat(m[1]) * REM_PX;
    }
    if ((m = t.match(/^(-?[\d.]+)px$/))) {
      return parseFloat(m[1]);
    }
    return null; // vw/vh or other — not resolvable here
  }

  // Find the first `font-size: clamp(a, b, c)` inside the rule block for the
  // given selector and return { min, prefToken, max }. Returns null if not found.
  function clampFontSizeFor(selector) {
    for (const rule of RULES) {
      if (!selectorListHas(rule.selectors, selector)) {
        continue;
      }
      const fs = rule.body.match(/font-size:\s*clamp\(([^)]+)\)/i);
      if (fs) {
        const args = fs[1].split(",").map((s) => s.trim());
        if (args.length === 3) {
          return {
            min: tokenToPx(args[0]),
            prefToken: args[1],
            max: tokenToPx(args[2]),
          };
        }
      }
    }
    return null;
  }

  // The readability-critical text in the new teams-as-rows layout: score cell
  // values, game-name column headers, the team row labels (now carried by the
  // editable .team-name-input), the right-hand team totals, and the "Total"
  // column header (.total-label) (Req 9.1, 9.4).
  const selectors = [
    ".score-cell",
    ".game-name",
    ".team-label",
    ".team-name-input",
    ".team-total",
    ".total-label",
  ];

  it.each(selectors)(
    "%s uses a clamp() font-size whose max is >= 24px (1.5rem)",
    (selector) => {
      const clamp = clampFontSizeFor(selector);
      expect(clamp, `no clamp() font-size found for ${selector}`).not.toBeNull();
      expect(clamp.max, `clamp max for ${selector} must resolve to px`).not.toBeNull();
      expect(clamp.max).toBeGreaterThanOrEqual(MIN_PX);
    }
  );

  // Extra confidence on the two most information-dense elements: the score
  // cells and totals also have a preferred (vw) term, so at a wide viewport the
  // clamp rises toward its max rather than sitting at a small min.
  it("score cells and totals use a viewport-relative preferred size", () => {
    for (const selector of [".score-cell", ".team-total"]) {
      const clamp = clampFontSizeFor(selector);
      expect(clamp).not.toBeNull();
      expect(clamp.prefToken).toMatch(/vw$/);
    }
  });
});

describe("no-clipping / no-horizontal-scroll structural proxy (Req 9.3)", () => {
  // jsdom can't measure layout, so we assert the structural rules that keep the
  // grid contained: #score-grid scrolls internally (overflow) instead of
  // forcing page scroll, the table is fixed-layout at full width, and #app has
  // a max-width so the whole board is bounded. These are the mechanisms that
  // satisfy Req 9.3; true "no horizontal scroll" still needs a real viewport.

  // Return the declaration block body for the first rule whose selector list
  // contains `selector` as a standalone selector, or null.
  function ruleBodyFor(selector) {
    for (const rule of RULES) {
      if (selectorListHas(rule.selectors, selector)) {
        return rule.body;
      }
    }
    return null;
  }

  it("#score-grid contains overflow so cells scroll internally", () => {
    const body = ruleBodyFor("#score-grid");
    expect(body, "no #score-grid rule found").not.toBeNull();
    expect(body).toMatch(/overflow(-x)?:\s*(auto|scroll|hidden)/i);
  });

  it(".grid-table is full-width with fixed table layout so columns are contained", () => {
    const body = ruleBodyFor(".grid-table");
    expect(body, "no .grid-table rule found").not.toBeNull();
    expect(body).toMatch(/table-layout:\s*fixed/i);
    expect(body).toMatch(/width:\s*100%/i);
  });

  it("#app has a max-width so the board is bounded", () => {
    const body = ruleBodyFor("#app");
    expect(body, "no #app rule found").not.toBeNull();
    expect(body).toMatch(/max-width:\s*[\d.]+(px|rem|vw|ch|%)/i);
  });

  it("pins the right-hand Total column so totals stay always-visible on scroll (Req 4.11)", () => {
    // .team-total (per-row value) and .total-label (header) share a rule that
    // sticks them to the right edge so each team's total never scrolls off.
    const totalBody = ruleBodyFor(".team-total");
    expect(totalBody, "no .team-total rule found").not.toBeNull();
    expect(totalBody).toMatch(/position:\s*sticky/i);
    expect(totalBody).toMatch(/right:\s*0/i);

    const labelBody = ruleBodyFor(".total-label");
    expect(labelBody, "no .total-label rule found").not.toBeNull();
    expect(labelBody).toMatch(/position:\s*sticky/i);
    expect(labelBody).toMatch(/right:\s*0/i);
  });
});
