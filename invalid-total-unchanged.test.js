import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  handleCellInput,
  createInitialState,
  teamTotal,
  TEAMS,
  GAMES,
  NEGATIVE_ALLOWED,
  SCORE_MIN,
  SCORE_MAX,
} from "./app.js";

// Property 4: Invalid entry leaves the affected team total unchanged.
// Validates: Requirements 3.6
describe("handleCellInput — Property 4: invalid entry leaves the affected team total unchanged", () => {
  const TEAM_IDS = TEAMS.map((t) => t.id);
  const GAME_IDS = GAMES.map((g) => g.id);

  // A well-formed ScoreMap: every team/game holds an in-range integer, negatives
  // only for quiet-place. Mirrors the persisted-shape rules the app enforces.
  const scoreMapArb = fc.record(
    Object.fromEntries(
      TEAM_IDS.map((team) => [
        team,
        fc.record(
          Object.fromEntries(
            GAME_IDS.map((game) => {
              const min = NEGATIVE_ALLOWED.has(game) ? SCORE_MIN : 0;
              return [game, fc.integer({ min, max: SCORE_MAX })];
            })
          )
        ),
      ])
    )
  );

  // An invalid raw value paired with a game for which it is genuinely invalid.
  // Three disjoint families, each guaranteed to be rejected:
  //   - non-integer strings (invalid for ANY game)
  //   - out-of-range integers |n| > 999 as strings (invalid for ANY game)
  //   - in-range negatives, paired only with a NON–quiet-place game
  const NON_QUIET_GAME_IDS = GAME_IDS.filter((id) => id !== "quiet-place");

  const nonIntegerCase = fc.record({
    game: fc.constantFrom(...GAME_IDS),
    raw: fc.oneof(
      fc.constantFrom("abc", "1.5", "+", "-", "NaN", "Infinity", "1e3", "  x  "),
      // Random strings, filtered to genuinely non-integer (and non-empty).
      fc.string().filter((s) => {
        const t = String(s).trim();
        return t !== "" && !/^[+-]?\d+$/.test(t);
      })
    ),
  });

  const outOfRangeCase = fc.record({
    game: fc.constantFrom(...GAME_IDS),
    raw: fc
      .integer({ min: 1000, max: 100000 })
      .chain((mag) => fc.boolean().map((neg) => String(neg ? -mag : mag))),
  });

  const negativeNotAllowedCase = fc.record({
    game: fc.constantFrom(...NON_QUIET_GAME_IDS),
    raw: fc.integer({ min: SCORE_MIN, max: -1 }).map(String),
  });

  const invalidCase = fc.oneof(
    nonIntegerCase,
    outOfRangeCase,
    negativeNotAllowedCase
  );

  it("leaves the affected team total (and cell) unchanged on rejection", () => {
    // Feature: halloween-party-scoring, Property 4: Invalid entry leaves the affected team total unchanged
    fc.assert(
      fc.property(
        scoreMapArb,
        fc.constantFrom(...TEAM_IDS),
        invalidCase,
        (scores, team, { game, raw }) => {
          const state = createInitialState();
          state.scores = scores;

          const before = teamTotal(state.scores, team);
          const cellBefore = state.scores[team][game];

          // Must not throw even though the default jsdom document has no cells;
          // renderTotals guards missing [data-total] elements.
          const result = handleCellInput(state, team, game, raw);

          expect(result.ok).toBe(false);
          expect(teamTotal(state.scores, team)).toBe(before);
          expect(state.scores[team][game]).toBe(cellBefore);
        }
      ),
      { numRuns: 100 }
    );
  });
});
