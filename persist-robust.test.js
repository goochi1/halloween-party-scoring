import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
  loadScores,
  STORAGE_KEY,
  TEAMS,
  GAMES,
  NEGATIVE_ALLOWED,
  SCORE_MIN,
  SCORE_MAX,
} from "./app.js";

// Property 7 — robust loading of arbitrary storage content.
// loadScores must never throw regardless of what sits at STORAGE_KEY, and when
// it reports "ok" the returned map must be complete and well-formed.

const TEAM_IDS = TEAMS.map((t) => t.id);
const GAME_IDS = GAMES.map((g) => g.id);
const KNOWN_STATUSES = new Set(["ok", "empty", "invalid", "unavailable"]);

// This jsdom config exposes a `localStorage` global that is an empty object with
// no Storage methods. app.js reads the global `localStorage` lazily on every
// call, so we install a minimal, spec-faithful in-memory Storage here (getItem
// returns null for absent keys and coerces values to strings, matching the Web
// Storage API) before any test runs. loadScores then reads through it normally.
function installStorage() {
  const map = new Map();
  const storage = {
    getItem(key) {
      return map.has(String(key)) ? map.get(String(key)) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
    clear() {
      map.clear();
    },
    key(i) {
      return Array.from(map.keys())[i] ?? null;
    },
    get length() {
      return map.size;
    },
  };
  globalThis.localStorage = storage;
  return storage;
}
installStorage();

// (d) valid-JSON-with-wrong-shape: objects that resemble the persisted payload
// but carry missing/wrong version fields and scores with unknown teams/games,
// out-of-range values, and illegal negatives.
const wrongShapeArb = fc.oneof(
  // Missing version and/or scores entirely.
  fc.record(
    { version: fc.integer(), scores: fc.object() },
    { requiredKeys: [] }
  ),
  // Wrong version number with an otherwise plausible scores object.
  fc.record({
    version: fc.integer().filter((n) => n !== 1),
    scores: fc.object(),
  }),
  // Scores with a mix of known/unknown teams and games, plus illegal values.
  fc.record({
    version: fc.oneof(fc.constant(1), fc.integer()),
    scores: fc.dictionary(
      fc.oneof(...[...TEAM_IDS, "Z", "team-x"].map((k) => fc.constant(k))),
      fc.dictionary(
        fc.oneof(
          ...[...GAME_IDS, "unknown-game", "abcd-names"].map((k) => fc.constant(k))
        ),
        fc.oneof(
          fc.integer({ min: -5000, max: 5000 }), // includes out-of-range
          fc.double(), // non-integers
          fc.string(),
          fc.boolean(),
          fc.constant(null)
        )
      )
    ),
  }),
  // Top-level valid JSON that is not even an object.
  fc.oneof(fc.integer(), fc.string(), fc.boolean(), fc.constant(null), fc.array(fc.integer()))
);

// Full generator for the raw string written to STORAGE_KEY.
const storageContentArb = fc.oneof(
  // (a) arbitrary strings
  fc.string(),
  // (b) malformed JSON — arbitrary strings that are unlikely to parse cleanly,
  // plus deliberate broken fragments.
  fc.oneof(
    fc.constant("{"),
    fc.constant("}"),
    fc.constant("[1,2,"),
    fc.constant('{"version":1,"scores":'),
    fc.constant("not json at all"),
    fc.constant("{'single':'quotes'}"),
    fc.string().map((s) => "{" + s)
  ),
  // (c) valid JSON of arbitrary shape
  fc.jsonValue().map((v) => JSON.stringify(v)),
  // (d) valid JSON with wrong shape
  wrongShapeArb.map((v) => JSON.stringify(v))
);

function isWellFormed(scores) {
  if (scores == null || typeof scores !== "object") return false;
  for (const team of TEAM_IDS) {
    const row = scores[team];
    if (row == null || typeof row !== "object") return false;
    for (const game of GAME_IDS) {
      const v = row[game];
      if (typeof v !== "number" || !Number.isInteger(v)) return false;
      if (v < SCORE_MIN || v > SCORE_MAX) return false;
      if (v < 0 && !NEGATIVE_ALLOWED.has(game)) return false;
    }
  }
  return true;
}

// Reset the store to a known-empty state before each run so runs never leak.
function resetStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

describe("Persistence — Property 7", () => {
  beforeEach(() => {
    resetStorage();
  });

  it("loading arbitrary storage content yields a well-formed map without throwing", () => {
    // Feature: halloween-party-scoring, Property 7: Loading arbitrary storage content yields a well-formed map without throwing
    // Validates: Requirements 5.6
    fc.assert(
      fc.property(storageContentArb, (content) => {
        resetStorage();
        localStorage.setItem(STORAGE_KEY, content);

        let result;
        // Must never throw.
        expect(() => {
          result = loadScores();
        }).not.toThrow();

        // Status is always one of the known statuses.
        expect(KNOWN_STATUSES.has(result.status)).toBe(true);

        // When ok, the returned map must be complete and well-formed.
        if (result.status === "ok") {
          expect(isWellFormed(result.scores)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});
