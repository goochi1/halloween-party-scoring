import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateScoreInput } from "./app.js";

// Property 3: Invalid input is rejected and the previous value is retained.
// Validates: Requirements 2.5, 2.6
describe("validateScoreInput — Property 3: invalid input is rejected and the previous value is retained", () => {
  const GAME_IDS = [
    "abcd-names",
    "bone-finder",
    "ghost-catcher",
    "pumpkin-toss",
    "quiet-place",
    "human-centipede",
  ];
  const NON_QUIET_GAME_IDS = GAME_IDS.filter((id) => id !== "quiet-place");

  // (a) Non-integer strings that the validator must reject with "non-integer".
  //     Deliberately excludes the empty/whitespace-only string, which is VALID
  //     (a cleared cell). Regex used: /^[+-]?\d+$/ on the trimmed input.
  const nonIntegerString = fc
    .oneof(
      // Random arbitrary strings...
      fc.string(),
      // ...and targeted classic non-integer forms.
      fc.constantFrom(
        "abc",
        "1.5",
        "-1.5",
        "+2.5",
        "3.14",
        "1,000",
        "0x10",
        "1e3",
        "1E3",
        "NaN",
        "Infinity",
        "-Infinity",
        "+",
        "-",
        "++5",
        "5-",
        "5a",
        "a5",
        "1 2",
        "12px",
        "  12x  ",
        "\t9.9\n",
        "２３", // full-width unicode digits (not ASCII \d in the app's regex)
        "१२" // devanagari digits
      )
    )
    // Keep only genuinely non-integer inputs: trimmed must be non-empty AND
    // must NOT match the accepted integer pattern.
    .filter((s) => {
      const t = String(s).trim();
      return t !== "" && !/^[+-]?\d+$/.test(t);
    });

  it("(a) rejects non-integer strings with reason 'non-integer', retaining previous value", () => {
    // Feature: halloween-party-scoring, Property 3: Invalid input is rejected and the previous value is retained
    fc.assert(
      fc.property(
        fc.integer({ min: -999, max: 999 }),
        fc.constantFrom(...GAME_IDS),
        nonIntegerString,
        (previousValue, gameId, raw) => {
          const result = validateScoreInput(raw, gameId, previousValue);
          expect(result.ok).toBe(false);
          expect(result.value).toBe(previousValue);
          expect(result.reason).toBe("non-integer");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("(b) rejects out-of-range integers with reason 'out-of-range', retaining previous value", () => {
    // Feature: halloween-party-scoring, Property 3: Invalid input is rejected and the previous value is retained
    fc.assert(
      fc.property(
        fc.integer({ min: -999, max: 999 }),
        // Magnitude strictly greater than 999, either sign.
        fc.integer({ min: 1000, max: 100000 }),
        fc.boolean(),
        (previousValue, magnitude, negative) => {
          const outOfRange = negative ? -magnitude : magnitude;
          // Pair with quiet-place so negatives are allowed and the ONLY reason
          // this can fail is out-of-range (removes ambiguity).
          const result = validateScoreInput(
            String(outOfRange),
            "quiet-place",
            previousValue
          );
          expect(result.ok).toBe(false);
          expect(result.value).toBe(previousValue);
          expect(result.reason).toBe("out-of-range");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("(c) rejects negatives for non-quiet-place games with reason 'negative-not-allowed', retaining previous value", () => {
    // Feature: halloween-party-scoring, Property 3: Invalid input is rejected and the previous value is retained
    fc.assert(
      fc.property(
        fc.integer({ min: -999, max: 999 }),
        // In-range negative so out-of-range cannot be the reason.
        fc.integer({ min: -999, max: -1 }),
        fc.constantFrom(...NON_QUIET_GAME_IDS),
        (previousValue, negative, gameId) => {
          const result = validateScoreInput(
            String(negative),
            gameId,
            previousValue
          );
          expect(result.ok).toBe(false);
          expect(result.value).toBe(previousValue);
          expect(result.reason).toBe("negative-not-allowed");
        }
      ),
      { numRuns: 100 }
    );
  });
});
