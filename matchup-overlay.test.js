import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  attachMatchupListeners,
  createInitialState,
  handleNameInput,
} from "./app.js";

// Task 15.5 — example tests for the matchup announcement overlay.
// Loads the real index.html <body> into jsdom so assertions reflect the actual
// built markup, then drives the overlay through the exported controller
// (attachMatchupListeners + createInitialState/handleNameInput) and real DOM
// events.
// _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

// Under jsdom import.meta.url is not a file: URL, so resolve against the project
// root (Vitest runs from the package directory).
const indexHtml = readFileSync(join(process.cwd(), "index.html"), "utf8");

// The three head-to-head games that carry a matchup toggle, and the games that
// must NOT (Req 12.1, 12.2).
const HEAD_TO_HEAD = ["ghost-catcher", "pumpkin-toss", "quiet-place"];
const NON_HEAD_TO_HEAD = ["abcd-names", "bone-finder", "human-centipede"];

// Inject only the <body> contents (real markup) after stripping any <script>
// so importing app.js is the sole entry point and bootstrap never runs twice.
function injectIndexHtml() {
  const bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let bodyInner = bodyMatch ? bodyMatch[1] : indexHtml;
  bodyInner = bodyInner.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  document.body.innerHTML = bodyInner;
}

beforeEach(() => {
  document.body.innerHTML = "";
  injectIndexHtml();
});

// Dispatch a bubbling click from a specific element so event.target is that
// element (guarded via window.MouseEvent for jsdom).
function clickFrom(el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

const overlay = () => document.querySelector("#matchup-overlay");
const content = () => document.querySelector("#matchup-content");
const toggleFor = (gameId) =>
  document.querySelector('[data-matchup-toggle="' + gameId + '"]');

describe("matchup control placement (Req 12.1, 12.2)", () => {
  it("shows a matchup toggle ONLY on the three head-to-head games", () => {
    const toggles = document.querySelectorAll("[data-matchup-toggle]");
    expect(toggles.length).toBe(3);

    const ids = Array.from(toggles)
      .map((b) => b.getAttribute("data-matchup-toggle"))
      .sort();
    expect(ids).toEqual([...HEAD_TO_HEAD].sort());

    // Each head-to-head game has exactly one toggle.
    for (const gameId of HEAD_TO_HEAD) {
      expect(toggleFor(gameId)).not.toBeNull();
    }
  });

  it("has NO toggle in the non-head-to-head game headers", () => {
    for (const gameId of NON_HEAD_TO_HEAD) {
      const header = document.querySelector(
        '[data-game-label="' + gameId + '"]'
      );
      expect(header).not.toBeNull();
      expect(header.querySelector("[data-matchup-toggle]")).toBeNull();
    }
  });
});

describe("opening the overlay (Req 12.3, 12.4)", () => {
  it("clicking a toggle shows the overlay with the matchup text (Req 12.3)", () => {
    const state = createInitialState();
    attachMatchupListeners(state, document);

    expect(overlay().hidden).toBe(true);

    clickFrom(toggleFor("ghost-catcher"));

    expect(overlay().hidden).toBe(false);
    expect(content().textContent).toBe(
      "Team A vs Team B & Team C vs Team D"
    );
  });

  it("substitutes custom team names into the matchup (Req 12.4)", () => {
    const state = createInitialState();
    handleNameInput(state, "A", "The Ghouls", document);
    attachMatchupListeners(state, document);

    clickFrom(toggleFor("ghost-catcher"));

    expect(content().textContent).toContain("The Ghouls");
    expect(content().textContent).toBe(
      "The Ghouls vs Team B & Team C vs Team D"
    );
  });
});

describe("hiding the overlay (Req 12.5, 12.6)", () => {
  it("toggling the same game twice hides it (Req 12.5)", () => {
    const state = createInitialState();
    attachMatchupListeners(state, document);

    clickFrom(toggleFor("ghost-catcher"));
    expect(overlay().hidden).toBe(false);

    clickFrom(toggleFor("ghost-catcher"));
    expect(overlay().hidden).toBe(true);
  });

  it("the dismiss button hides the overlay (Req 12.5, 12.6)", () => {
    const state = createInitialState();
    attachMatchupListeners(state, document);

    clickFrom(toggleFor("ghost-catcher"));
    expect(overlay().hidden).toBe(false);

    clickFrom(document.querySelector("#matchup-dismiss"));
    expect(overlay().hidden).toBe(true);
  });

  it("backdrop click hides but a panel click does NOT (Req 12.6)", () => {
    const state = createInitialState();
    attachMatchupListeners(state, document);

    // A click that lands on the overlay element itself (backdrop) dismisses:
    // dispatching on the overlay makes event.target === overlay.
    clickFrom(toggleFor("ghost-catcher"));
    expect(overlay().hidden).toBe(false);
    clickFrom(overlay());
    expect(overlay().hidden).toBe(true);

    // A click bubbling up from the inner panel has target === panel, so the
    // handler leaves the overlay open.
    clickFrom(toggleFor("ghost-catcher"));
    expect(overlay().hidden).toBe(false);
    const panel = document.querySelector(".matchup-overlay-inner");
    expect(panel).not.toBeNull();
    clickFrom(panel);
    expect(overlay().hidden).toBe(false);
  });
});

describe("opening/closing never touches scores or names (Req 12.6)", () => {
  it("preserves state.scores and state.names across open + close", () => {
    const state = createInitialState();
    handleNameInput(state, "B", "Skeletons", document);
    state.scores.A["ghost-catcher"] = 7;
    state.scores.C["quiet-place"] = -3;

    attachMatchupListeners(state, document);

    const scoresSnapshot = JSON.parse(JSON.stringify(state.scores));
    const namesSnapshot = JSON.parse(JSON.stringify(state.names));

    // Open then close via the dismiss control.
    clickFrom(toggleFor("ghost-catcher"));
    clickFrom(document.querySelector("#matchup-dismiss"));

    expect(state.scores).toEqual(scoresSnapshot);
    expect(state.names).toEqual(namesSnapshot);
  });
});
