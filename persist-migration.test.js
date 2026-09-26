import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
  loadScores,
  STORAGE_KEY,
  emptyScoreMap,
  TEAMS,
  GAMES,
  NEGATIVE_ALLOWED,
  SCORE_MIN,
  SCORE_MAX,
} from "./app.js";

// Property 9: Legacy version-1 storage migrates instead of being discarded.
// A legacy `{ version: 1, scores }` payload (no names field) must load as
// status "ok" — never "invalid" — with the scores preserved and names
// defaulted to {}. Because the generated map is well-formed, loadScores'
// internal normalization leaves it unchanged, so it must deep-equal the input.

const TEAM_IDS = TEAMS.map((t) => t.id);

// Per-game cell arbitrary: quiet-place permits negatives, every other game is
// constrained to non-negative so the map is well-formed and survives
// normalization untouched.
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

// Write a legacy version-1 payload directly to storage (scores only, no names).
function writeLegacyV1(scores) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, scores }));
}

describe("Persistence — Property 9", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it("legacy version-1 storage migrates instead of being discarded", () => {
    // Feature: halloween-party-scoring, Property 9: Legacy version-1 storage migrates instead of being discarded
    // Validates: Requirements 5.4, 5.8, 10.4
    fc.assert(
      fc.property(wellFormedScoreMapArb, (scores) => {
        // Reset the store each run so runs don't interfere.
        localStorage.removeItem(STORAGE_KEY);

        writeLegacyV1(scores);

        const result = loadScores();
        // Migration, not data loss: never "invalid".
        expect(result.status).toBe("ok");
        // Scores preserved intact (well-formed map normalizes to itself).
        expect(result.scores).toEqual(scores);
        // No names in a v1 payload -> default/empty names.
        expect(result.names).toEqual({});
      }),
      { numRuns: 100 }
    );
  });

  it("a hand-written v1 payload loads ok with its scores and empty names", () => {
    const scores = emptyScoreMap();
    scores.A["abcd-names"] = 12;
    scores.B["bone-finder"] = 7;
    scores.C["quiet-place"] = -5;
    scores.D["human-centipede"] = 999;

    writeLegacyV1(scores);

    const result = loadScores();
    expect(result.status).toBe("ok");
    expect(result.scores).toEqual(scores);
    expect(result.names).toEqual({});
  });
});
