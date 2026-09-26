// Unit tests for Config correctness.
// Validates: Requirements 1.1, 1.2, 1.3, 1.4
import { describe, it, expect } from "vitest";
import { TEAMS, GAMES } from "./app.js";

// Requirement 1.1: exactly four teams A–D with labels "Team A".."Team D".
describe("Config teams", () => {
  it("has exactly four teams with ids A, B, C, D and labels Team A..Team D", () => {
    expect(TEAMS).toHaveLength(4);
    expect(TEAMS.map((t) => t.id)).toEqual(["A", "B", "C", "D"]);
    expect(TEAMS.map((t) => t.label)).toEqual([
      "Team A",
      "Team B",
      "Team C",
      "Team D",
    ]);
  });
});

// Requirement 1.2: exactly six games in the required order with exact labels.
describe("Config games", () => {
  it("has exactly six games in the required order with exact labels", () => {
    expect(GAMES).toHaveLength(6);
    expect(GAMES.map((g) => g.id)).toEqual([
      "abcd-names",
      "bone-finder",
      "ghost-catcher",
      "pumpkin-toss",
      "quiet-place",
      "human-centipede",
    ]);
    expect(GAMES.map((g) => g.label)).toEqual([
      "ABCD Names",
      "Bone Finder",
      "Ghost Catcher",
      "Pumpkin Toss",
      "Quiet Place",
      "Human Centipede",
    ]);
  });

  // Requirement 1.3: exact matchup strings for the three games that define one.
  it("has exact matchup strings for ghost-catcher, pumpkin-toss, quiet-place", () => {
    const byId = Object.fromEntries(GAMES.map((g) => [g.id, g]));
    expect(byId["ghost-catcher"].matchup).toBe(
      "Team A vs Team B & Team C vs Team D"
    );
    expect(byId["pumpkin-toss"].matchup).toBe(
      "Team A vs Team C & Team B vs Team D"
    );
    expect(byId["quiet-place"].matchup).toBe(
      "Team A vs Team D & Team B vs Team C"
    );
  });

  // Requirement 1.4: no matchup for the games without one.
  it("has no matchup for abcd-names, bone-finder, human-centipede", () => {
    const byId = Object.fromEntries(GAMES.map((g) => [g.id, g]));
    expect(byId["abcd-names"].matchup).toBeFalsy();
    expect(byId["bone-finder"].matchup).toBeFalsy();
    expect(byId["human-centipede"].matchup).toBeFalsy();
  });
});
