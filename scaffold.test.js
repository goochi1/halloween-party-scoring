import { describe, it, expect } from "vitest";
import * as app from "./app.js";

// Placeholder test confirming the runner executes and app.js imports headlessly
// (no real DOM required). Replaced by real suites in later tasks.
describe("scaffold", () => {
  it("imports the pure modules without a DOM", () => {
    expect(app.Config).toBeDefined();
    expect(app.Validation).toBeDefined();
    expect(app.Totals).toBeDefined();
    expect(app.Persistence).toBeDefined();
    expect(app.STORAGE_KEY).toBe("halloween-party-scoring:v1");
  });
});
