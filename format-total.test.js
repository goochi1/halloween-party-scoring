// Feature: halloween-party-scoring, Property 5: Negative totals display with a leading minus sign
import { describe, it } from "vitest";
import fc from "fast-check";
import { formatTotal } from "./app.js";

// Property 5: Negative totals display with a leading minus sign.
// Validates: Requirements 3.5
//
// For any integer total, the formatted string begins with a minus sign iff the
// total is negative, and otherwise preserves the magnitude digits exactly.
// Zero formats as "0" with no minus.
describe("Property 5: negative total formatting", () => {
  it("prefixes a minus sign iff negative and preserves magnitude digits", () => {
    fc.assert(
      fc.property(fc.integer(), (total) => {
        const formatted = formatTotal(total);

        // Leading "-" iff the total is negative.
        if (total < 0) {
          if (!formatted.startsWith("-")) {
            return false;
          }
        } else if (formatted.startsWith("-")) {
          return false;
        }

        // Magnitude digits equal the absolute value's digits (minus stripped).
        const magnitude = formatted.startsWith("-") ? formatted.slice(1) : formatted;
        return magnitude === String(Math.abs(total));
      }),
      { numRuns: 100 }
    );
  });
});
