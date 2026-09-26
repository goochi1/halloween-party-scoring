import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { teamTotal, TEAMS, GAMES, SCORE_MIN, SCORE_MAX } from "./app.js";

// Property test for the Totals module (pure). Verifies that a team's total is
// exactly the arithmetic sum of that team's six game scores, with any missing
// (unset) cell counted as zero.

const TEAM_IDS = TEAMS.map((t) => t.id);
const GAME_IDS = GAMES.map((g) => g.id);

// Arbitrary for one team's row: each of the six game ids maps to an integer in
// [-999, 999] (negatives fine — teamTotal is pure arithmetic). Some game keys
// are sometimes omitted so the "missing = 0" behavior is exercised.
const rowArb = fc
  .record(
    Object.fromEntries(
      GAME_IDS.map((id) => [id, fc.integer({ min: SCORE_MIN, max: SCORE_MAX })])
    ),
    // requiredKeys: [] makes every key optional, so cells can be missing.
    { requiredKeys: [] }
  );

// Arbitrary for a full ScoreMap: one row per team.
const scoreMapArb = fc.record(
  Object.fromEntries(TEAM_IDS.map((id) => [id, rowArb]))
);

describe("Totals — Property 1", () => {
  it("team total equals the sum of its game scores (missing = 0)", () => {
    // Feature: halloween-party-scoring, Property 1: Team total equals the sum of its game scores
    // Validates: Requirements 2.3, 3.2, 3.3, 4.5
    fc.assert(
      fc.property(scoreMapArb, (scores) => {
        for (const team of TEAM_IDS) {
          const row = scores[team] || {};
          let expected = 0;
          for (const game of GAME_IDS) {
            const v = row[game];
            if (typeof v === "number" && Number.isFinite(v)) {
              expected += v;
            }
          }
          expect(teamTotal(scores, team)).toBe(expected);
        }
      }),
      { numRuns: 100 }
    );
  });
});
