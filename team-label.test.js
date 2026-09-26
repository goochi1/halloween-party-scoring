import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { teamLabel, setName, TEAMS, NAME_MAX_LEN } from "./app.js";

// Property test for team label resolution (Names module, pure). Verifies that
// teamLabel returns a team's custom name when it resolves to a non-empty (after
// trimming) string, else the team's default "Team A".."Team D" label — and that
// names stored via setName are clamped to NAME_MAX_LEN (30) characters.

const TEAM_IDS = TEAMS.map((t) => t.id);

// Map of team id -> default label, for expected-value computation.
const DEFAULT_LABEL = Object.fromEntries(TEAMS.map((t) => [t.id, t.label]));

describe("Names — Property 8", () => {
  it("team label resolves to the custom name when set, else the default", () => {
    // Feature: halloween-party-scoring, Property 8: Team label resolves to the custom name when set, else the default
    // Validates: Requirements 11.2, 11.4, 11.5, 11.6
    fc.assert(
      fc.property(fc.constantFrom(...TEAM_IDS), fc.string(), (teamId, raw) => {
        // Store via setName so the value is clamped to NAME_MAX_LEN (no trim).
        const names = setName({}, teamId, raw);
        const stored = names[teamId];

        // setName clamps to <= 30 chars (Req 11.5).
        expect(stored.length).toBeLessThanOrEqual(NAME_MAX_LEN);

        // teamLabel returns the stored custom name iff it is non-empty after
        // trimming, else the default label (Req 11.2, 11.4, 11.6).
        const expected = stored.trim() !== "" ? stored : DEFAULT_LABEL[teamId];
        expect(teamLabel(names, teamId)).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  // Custom name path: any non-empty name with a non-whitespace char and length
  // <= 30 is returned verbatim by teamLabel (internal formatting preserved).
  it("returns the exact custom name for non-empty <=30-char names with non-whitespace", () => {
    const nameArb = fc
      .string({ maxLength: NAME_MAX_LEN })
      .filter((s) => s.trim() !== "");
    fc.assert(
      fc.property(fc.constantFrom(...TEAM_IDS), nameArb, (teamId, name) => {
        // Plain object map path (no setName), since name is already <= 30.
        const names = { [teamId]: name };
        expect(teamLabel(names, teamId)).toBe(name);
      }),
      { numRuns: 100 }
    );
  });

  // Empty / whitespace-only names fall back to the default label.
  it("falls back to the default label for empty and whitespace-only names", () => {
    for (const teamId of TEAM_IDS) {
      expect(teamLabel({ [teamId]: "" }, teamId)).toBe(DEFAULT_LABEL[teamId]);
      expect(teamLabel({ [teamId]: "   " }, teamId)).toBe(DEFAULT_LABEL[teamId]);
      expect(teamLabel({ [teamId]: "\t" }, teamId)).toBe(DEFAULT_LABEL[teamId]);
    }
  });

  // Unset (no entry / empty map) falls back to the default label.
  it("falls back to the default label when the team is unset", () => {
    for (const teamId of TEAM_IDS) {
      expect(teamLabel({}, teamId)).toBe(DEFAULT_LABEL[teamId]);
      // Map present but missing this team.
      const others = {};
      for (const other of TEAM_IDS) {
        if (other !== teamId) others[other] = "Custom " + other;
      }
      expect(teamLabel(others, teamId)).toBe(DEFAULT_LABEL[teamId]);
    }
  });

  // Over-length names are clamped to 30 chars by setName; teamLabel then returns
  // that 30-char value (Req 11.5).
  it("clamps over-length names to 30 chars via setName", () => {
    const raw = "x".repeat(40);
    for (const teamId of TEAM_IDS) {
      const names = setName({}, teamId, raw);
      expect(names[teamId].length).toBe(NAME_MAX_LEN);
      expect(names[teamId]).toBe(raw.slice(0, NAME_MAX_LEN));
      expect(teamLabel(names, teamId)).toBe(raw.slice(0, NAME_MAX_LEN));
    }
  });

  // A normal custom name is returned as-is.
  it("returns a normal custom name unchanged", () => {
    const names = setName({}, "A", "Ghostbusters");
    expect(teamLabel(names, "A")).toBe("Ghostbusters");
  });
});
