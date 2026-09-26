import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { formatMatchup, teamLabel, TEAMS } from "./app.js";

// Task 15.4 — Property 10: Matchup announcement substitutes current names and
// preserves structure (Req 12.3, 12.4).
//
// formatMatchup(pairs, names) renders each pair [a, b] as
// `${teamLabel(names,a)} vs ${teamLabel(names,b)}` and joins pairs with " & ".
// Because every id resolves through teamLabel, a team with a custom name always
// shows that name and the literal "Team X" default appears only where a name is
// unset. The property below drives random pair lists and name maps and asserts
// the output equals the label-substituted, structure-preserving reconstruction.

const IDS = TEAMS.map((t) => t.id); // ["A","B","C","D"]

function countOccurrences(haystack, needle) {
  if (needle === "") return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

describe("Property 10: matchup announcement substitutes names and preserves structure", () => {
  it("substitutes each id's label and preserves pair/separator structure (Req 12.3, 12.4)", () => {
    // Feature: halloween-party-scoring, Property 10: Matchup announcement substitutes current names and preserves structure

    // A pair is two team ids (same or different allowed).
    const pairArb = fc.tuple(fc.constantFrom(...IDS), fc.constantFrom(...IDS));
    const pairsArb = fc.array(pairArb, { minLength: 1, maxLength: 3 });

    // For each team id, sometimes a distinctive custom name (never containing
    // "Team " so the "default absent" assertion is robust), sometimes unset.
    const customNameArb = fc.oneof(
      fc.constantFrom(...IDS.map((id) => "Ghoul-" + id)),
      fc
        .string({ minLength: 1, maxLength: 30 })
        .filter((s) => s.trim() !== "" && !/\s/.test(s) && !s.includes("Team "))
    );
    const nameMapArb = fc.record(
      IDS.reduce((acc, id) => {
        acc[id] = fc.option(customNameArb, { nil: undefined });
        return acc;
      }, {})
    );

    fc.assert(
      fc.property(pairsArb, nameMapArb, (pairs, rawNames) => {
        // Drop unset entries so the map holds only custom names.
        const names = {};
        for (const id of IDS) {
          if (typeof rawNames[id] === "string" && rawNames[id] !== "") {
            names[id] = rawNames[id];
          }
        }

        const expected = pairs
          .map(([a, b]) => `${teamLabel(names, a)} vs ${teamLabel(names, b)}`)
          .join(" & ");
        const result = formatMatchup(pairs, names);

        // Substitution + structure in one equality.
        expect(result).toBe(expected);

        // Structure: one " vs " per pair, one " & " per gap between pairs.
        expect(countOccurrences(result, " vs ")).toBe(pairs.length);
        expect(countOccurrences(result, " & ")).toBe(pairs.length - 1);

        // No residual default for a team that has a custom name and appears in
        // pairs. Custom names are constrained to exclude "Team ", so the default
        // "Team X" must be absent while the custom name is present.
        const appearing = new Set();
        for (const [a, b] of pairs) {
          appearing.add(a);
          appearing.add(b);
        }
        for (const id of appearing) {
          const custom = names[id];
          if (typeof custom === "string" && custom !== "" && !custom.includes("Team ")) {
            expect(result.includes(custom)).toBe(true);
            expect(result.includes("Team " + id)).toBe(false);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it("matches explicit examples", () => {
    expect(formatMatchup([["A", "B"], ["C", "D"]], {})).toBe(
      "Team A vs Team B & Team C vs Team D"
    );
    expect(formatMatchup([["A", "B"], ["C", "D"]], { A: "Ghouls" })).toBe(
      "Ghouls vs Team B & Team C vs Team D"
    );
    expect(formatMatchup([], { A: "Ghouls" })).toBe("");
  });
});
