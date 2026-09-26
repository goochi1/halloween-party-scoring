import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  saveScores,
  loadScores,
  isStorageAvailable,
  emptyScoreMap,
  STORAGE_KEY,
  TEAMS,
  GAMES,
} from "./app.js";

// Example-based unit tests for the Persistence module's error / edge flows
// (Task 6.4). app.js reads the global `localStorage` lazily on every call, so
// we install a controlled in-memory Storage and simulate failures by swapping
// individual methods to throw.
//
// Note on environment: this jsdom config exposes a `localStorage` global that
// is a plain object with no working Storage methods (the same reason
// persist-robust.test.js installs its own). Spying on Storage.prototype has no
// effect because the ambient localStorage is not backed by Storage.prototype.
// Installing a faithful in-memory storage — and overriding its methods to
// throw — is the reliable, deterministic way to exercise these failure paths.

// Build a minimal, spec-faithful in-memory Storage: getItem returns null for
// absent keys and setItem coerces values to strings, matching the Web Storage
// API. Returned so individual tests can override methods to simulate failures.
function makeStorage() {
  const map = new Map();
  return {
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
}

let originalLocalStorage;
let storage;

beforeEach(() => {
  originalLocalStorage = globalThis.localStorage;
  storage = makeStorage();
  globalThis.localStorage = storage;
});

afterEach(() => {
  globalThis.localStorage = originalLocalStorage;
});

describe("Persistence — error flows", () => {
  // Req 5.2: a write failure is swallowed — saveScores reports failure and does
  // not throw.
  it("saveScores returns {ok:false} and does not throw when setItem throws", () => {
    storage.setItem = () => {
      throw new Error("quota");
    };

    let result;
    expect(() => {
      result = saveScores(emptyScoreMap());
    }).not.toThrow();
    expect(result).toEqual({ ok: false });
  });

  // Req 5.5: a read failure is swallowed — loadScores reports the read-failure
  // status ("unavailable") and does not throw.
  it("loadScores returns {status:'unavailable'} and does not throw when getItem throws", () => {
    storage.getItem = () => {
      throw new Error("read blocked");
    };

    let result;
    expect(() => {
      result = loadScores();
    }).not.toThrow();
    expect(result).toEqual({ status: "unavailable" });
  });

  // Req 5.4: with no saved data at STORAGE_KEY, loadScores reports "empty" so
  // the controller initializes zeros.
  it("loadScores returns {status:'empty'} when no data is saved", () => {
    storage.removeItem(STORAGE_KEY); // ensure key absent

    const result = loadScores();
    expect(result).toEqual({ status: "empty" });
  });

  // Req 5.4 (support): the canonical empty map is all-zero with full shape —
  // every team present, every game present, every cell 0.
  it("emptyScoreMap is all-zero with full team/game shape", () => {
    const map = emptyScoreMap();

    expect(Object.keys(map).sort()).toEqual(TEAMS.map((t) => t.id).sort());
    for (const team of TEAMS) {
      const row = map[team.id];
      expect(Object.keys(row).sort()).toEqual(GAMES.map((g) => g.id).sort());
      for (const game of GAMES) {
        expect(row[game.id]).toBe(0);
      }
    }
  });

  // Req 10.5: when storage is unavailable (read/write/remove all throw),
  // isStorageAvailable() reports false so the controller runs in-memory and
  // shows a message.
  it("isStorageAvailable() is false when storage operations throw", () => {
    storage.setItem = () => {
      throw new Error("blocked");
    };
    storage.getItem = () => {
      throw new Error("blocked");
    };
    storage.removeItem = () => {
      throw new Error("blocked");
    };

    let available;
    expect(() => {
      available = isStorageAvailable();
    }).not.toThrow();
    expect(available).toBe(false);
  });
});
