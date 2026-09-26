import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import {
  handleReset,
  createInitialState,
  emptyScoreMap,
  loadScores,
  TEAMS,
  GAMES,
  NEGATIVE_ALLOWED,
  SCORE_MIN,
  SCORE_MAX,
  NAME_MAX_LEN,
  normalizeNames,
} from "./app.js";

// Property test for Property 11 (Task 14.4): reset zeros all scores while
// preserving team names. handleReset(state) on confirm zeros state.scores to
// emptyScoreMap(), leaves state.names untouched (Req 11.7), and re-persists
// {version:2, zeros, names} so the kept names survive in storage too (Req 6.4).

const TEAM_IDS = TEAMS.map((t) => t.id);

// Per-game cell arbitrary: quiet-place permits negatives, every other game is
// constrained to non-negative so the generated map is well-formed.
function cellArb(gameId) {
  const min = NEGATIVE_ALLOWED.has(gameId) ? SCORE_MIN : 0;
  return fc.integer({ min, max: SCORE_MAX });
}

// One team's row: every one of the six games present, per-game rules applied.
const rowArb = fc.record(
  Object.fromEntries(GAMES.map((g) => [g.id, cellArb(g.id)]))
);

// A well-formed ScoreMap: every team A–D present, each with a complete row.
const wellFormedScoreMapArb = fc.record(
  Object.fromEntries(TEAM_IDS.map((id) => [id, rowArb]))
);

// A NameMap: a subset of valid teams, each sometimes mapped to a custom name of
// length 1..30, sometimes empty (""); some teams omitted entirely. All forms
// are normalization-stable for valid team ids with string values.
const nameMapArb = fc.record(
  Object.fromEntries(
    TEAM_IDS.map((id) => [
      id,
      fc.oneof(
        fc.constant(""),
        fc.string({ minLength: 1, maxLength: NAME_MAX_LEN })
      ),
    ])
  ),
  { requiredKeys: [] }
);

describe("Reset — Property 11", () => {
  let originalConfirm;

  beforeEach(() => {
    originalConfirm = globalThis.confirm;
  });

  afterEach(() => {
    globalThis.confirm = originalConfirm;
  });

  it("reset zeros all scores while preserving team names", () => {
    // Feature: halloween-party-scoring, Property 11: Reset zeros all scores while preserving team names
    // Validates: Requirements 6.4, 11.7
    fc.assert(
      fc.property(wellFormedScoreMapArb, nameMapArb, (scores, names) => {
        // Fresh storage per run so runs don't interfere.
        globalThis.localStorage.clear();
        globalThis.confirm = () => true;

        const state = createInitialState();
        state.scores = scores;
        state.names = names;
        state.storage = "ok";

        const namesBefore = structuredClone(names);

        // Bare jsdom document: handleReset guards missing elements.
        const result = handleReset(state, document);

        // Confirmed reset succeeds.
        expect(result).toBe(true);
        // All scores zeroed to the canonical empty shape.
        expect(state.scores).toEqual(emptyScoreMap());
        // Names preserved unchanged in memory (Req 11.7).
        expect(state.names).toEqual(namesBefore);

        // Names survive in storage too: reset re-persists {zeros, names}.
        const loaded = loadScores();
        expect(loaded.status).toBe("ok");
        expect(loaded.scores).toEqual(emptyScoreMap());
        expect(loaded.names).toEqual(normalizeNames(namesBefore));
      }),
      { numRuns: 100 }
    );
  });
});
