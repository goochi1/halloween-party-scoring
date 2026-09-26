// Vitest global setup — install a working in-memory Storage.
//
// The jsdom environment used by Vitest does not provide a functional
// `localStorage` (its Storage methods are missing / `--localstorage-file` is
// not configured in jsdom 25). app.js reads the global `localStorage` lazily
// on every call, so we install a minimal, spec-faithful in-memory Storage on
// globalThis before any test runs, and reset it before each test. This is the
// single source of truth so individual test files don't need their own
// per-file storage installs.
import { beforeEach } from "vitest";

// Build a minimal, spec-faithful in-memory Storage matching the Web Storage
// API: getItem returns null for absent keys, setItem coerces key/value to
// strings, key(i) returns null out of range, and length reflects the count.
function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      const k = String(key);
      return map.has(k) ? map.get(k) : null;
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

// Always install a fresh, working storage — overwriting anything (possibly
// broken) that jsdom provided. defineConfig with configurable/writable so
// tests that swap methods or reassign the global still work.
function installStorage(name) {
  const storage = createMemoryStorage();
  Object.defineProperty(globalThis, name, {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage;
}

installStorage("localStorage");
installStorage("sessionStorage");

// Reset to a known-empty state before each test so state never leaks between
// tests or between runs of a property test.
beforeEach(() => {
  installStorage("localStorage");
  installStorage("sessionStorage");
});
