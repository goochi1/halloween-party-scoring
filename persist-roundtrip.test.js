import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
  saveScores,
  loadScores,
  clearScores,
  TEAMS,
  GAMES,
  NEGATIVE_ALLOWED,
  SCORE_MIN,
  SCORE_MAX,
  NAME_MAX_LEN,
  normalizeNames,
} from "./app.js";

// Property test for the Persistence module (pure). Verifies that saving a
// well-formed ScoreMap together with a NameMap and then loading it yields an
// equal {scores, names} pair — the round-trip is the identity. Because the map
// is well-formed (every team and game present, values respecting the scoring
// rules) and names are normalization-stable (only-string values <=30 chars
// keyed by valid team ids), loadScores' normalization must not alter anything.

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

// A normalization-stable NameMap: a subset of valid teams, each mapped to a
// custom name string of length 0..30 (fc.string caps length at NAME_MAX_LEN so
// no clamping ever changes a value). Some teams get "", some non-empty, and
// some are omitted entirely — all forms normalizeNames keeps unchanged for
// valid team ids with string values.
const nameMapArb = fc.record(
  Object.fromEntries(
    TEAM_IDS.map((id) => [id, fc.string({ maxLength: NAME_MAX_LEN })])
  ),
  { requiredKeys: [] }
);

describe("Persistence — Property 6", () => {
  beforeEach(() => {
    clearScores();
  });

  it("persistence round-trip is the identity for well-formed scores and names", () => {
    // Feature: halloween-party-scoring, Property 6: Persistence round-trip is the identity
    // Validates Requirements 5.1, 5.2, 5.4, 10.4, 11.3
    fc.assert(
      fc.property(wellFormedScoreMapArb, nameMapArb, (map, names) => {
        // Reset storage between runs so runs don't interfere.
        clearScores();

        const saved = saveScores(map, names);
        expect(saved.ok).toBe(true);

        const result = loadScores();
        expect(result.status).toBe("ok");
        expect(result.scores).toEqual(map);
        // loadScores normalizes names on read; for <=30-char string maps over
        // valid teams normalizeNames is the identity, but comparing against the
        // normalized form is the robust assertion.
        expect(result.names).toEqual(normalizeNames(names));
      }),
      { numRuns: 100 }
    );
  });
});
