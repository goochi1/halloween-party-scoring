import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  handleReset,
  createInitialState,
  emptyScoreMap,
  loadScores,
  saveScores,
  TEAMS,
  GAMES,
} from "./app.js";

// Example-based unit tests for the reset flow (Task 8.5, Req 6.1–6.4).
//
// handleReset() asks globalThis.confirm() before touching anything, clears the
// store on confirm, zeros in-memory scores on a successful clear, retains
// everything on cancel, and retains prior data + shows a message when the clear
// fails. Each test controls the confirm dialog via a vi.fn() and, for the
// failure case, forces the module's clearScores (localStorage.removeItem) to
// throw so the app catches it and reports {ok:false}.

// Build a small real DOM with a message banner, a couple of score cells, and a
// couple of total cells so renderGrid / showMessage / clearMessage have targets.
function installDom() {
  document.body.innerHTML = `
    <div id="message-banner" hidden></div>
    <input class="score-cell" data-team="A" data-game="abcd-names" />
    <input class="score-cell" data-team="B" data-game="quiet-place" />
    <span data-total="A"></span>
    <span data-total="B"></span>
  `;
}

// A non-zero score map for seeding state. Uses a game that permits negatives
// (quiet-place) for the negative cell so the value is legitimate.
function seededScores() {
  const map = emptyScoreMap();
  map.A["abcd-names"] = 5;
  map.B["bone-finder"] = 12;
  map.B["quiet-place"] = -3;
  return map;
}

let originalConfirm;

beforeEach(() => {
  originalConfirm = globalThis.confirm;
  installDom();
});

afterEach(() => {
  globalThis.confirm = originalConfirm;
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("handleReset — reset flow", () => {
  // Req 6.1 + 6.3: confirmation is required and a cancel retains everything.
  it("returns false and changes nothing when confirm is cancelled", () => {
    globalThis.confirm = vi.fn(() => false);

    const state = createInitialState();
    state.scores = seededScores();
    state.entered = new Set(["A:abcd-names", "B:bone-finder", "B:quiet-place"]);
    state.errors = { "A:abcd-names": "non-integer" };
    const scoresBefore = structuredClone(state.scores);

    const result = handleReset(state, document);

    expect(globalThis.confirm).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
    // Nothing cleared or zeroed.
    expect(state.scores).toEqual(scoresBefore);
    expect(state.entered.size).toBe(3);
    expect(state.errors).toEqual({ "A:abcd-names": "non-integer" });
  });

  // Req 6.2: on confirm, zero everything in memory and clear the store.
  it("returns true, zeros scores, and clears the store when confirmed", () => {
    globalThis.confirm = vi.fn(() => true);

    const state = createInitialState();
    state.scores = seededScores();
    state.entered = new Set(["A:abcd-names", "B:bone-finder", "B:quiet-place"]);
    state.errors = { "B:quiet-place": "out-of-range" };
    state.storage = "ok";

    // Persist the seeded scores so we can confirm the store is cleared after.
    expect(saveScores(state.scores)).toEqual({ ok: true });
    expect(loadScores().status).toBe("ok");

    const result = handleReset(state, document);

    expect(globalThis.confirm).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
    // All cells zeroed to the canonical empty shape.
    expect(state.scores).toEqual(emptyScoreMap());
    expect(state.entered.size).toBe(0);
    expect(state.errors).toEqual({});
    // Reset re-persists {version:2, zeros, names} to preserve names (Req 6.4/11.7),
    // so the store now reflects a reset-but-names-preserved state, not "empty".
    // This state had no custom names (seededScores sets only scores), so names is {}.
    const loaded = loadScores();
    expect(loaded.status).toBe("ok");
    expect(loaded.scores).toEqual(emptyScoreMap());
    expect(loaded.names).toEqual({});
  });

  // Req 6.4: a clear failure retains prior in-memory data (does NOT zero) and
  // surfaces an error message.
  it("returns false, retains prior scores, and shows a message when clear fails", () => {
    globalThis.confirm = vi.fn(() => true);

    const state = createInitialState();
    state.scores = seededScores();
    state.entered = new Set(["A:abcd-names", "B:bone-finder", "B:quiet-place"]);
    state.storage = "ok";
    const scoresBefore = structuredClone(state.scores);

    // Force the module's clearScores (localStorage.removeItem) to throw; the
    // app catches it and returns {ok:false}.
    const originalRemoveItem = globalThis.localStorage.removeItem;
    globalThis.localStorage.removeItem = () => {
      throw new Error("remove blocked");
    };

    let result;
    try {
      result = handleReset(state, document);
    } finally {
      globalThis.localStorage.removeItem = originalRemoveItem;
    }

    expect(result).toBe(false);
    // Prior scores retained, not zeroed.
    expect(state.scores).toEqual(scoresBefore);
    expect(state.entered.size).toBe(3);

    // Error message shown (banner visible with an error kind).
    const banner = document.querySelector("#message-banner");
    expect(banner.hidden).toBe(false);
    expect(banner.getAttribute("data-kind")).toBe("error");
    expect(banner.textContent.length).toBeGreaterThan(0);
  });
});
