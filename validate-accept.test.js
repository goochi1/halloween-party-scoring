import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateScoreInput } from "./app.js";

// Property 2: Valid in-range integers are accepted.
// Validates: Requirements 2.2, 2.4
describe("validateScoreInput — Property 2: valid in-range integers are accepted", () => {
  const GAME_IDS = [
    "abcd-names",
    "bone-finder",
    "ghost-catcher",
    "pumpkin-toss",
    "quiet-place",
    "human-centipede",
  ];

  it("accepts any in-range integer (negatives only for quiet-place)", () => {
    // Feature: halloween-party-scoring, Property 2: Valid in-range integers are accepted
    fc.assert(
      fc.property(
        fc.constantFrom(...GAME_IDS),
        fc.integer({ min: -999, max: 999 }),
        (gameId, n) => {
          // Enforce the negative rule: negatives are only valid for quiet-place.
          fc.pre(n >= 0 || gameId === "quiet-place");

          // Host types text, so the raw input is a string.
          const result = validateScoreInput(String(n), gameId);

          expect(result.ok).toBe(true);
          expect(result.value).toBe(n);
        }
      ),
      { numRuns: 100 }
    );
  });
});
