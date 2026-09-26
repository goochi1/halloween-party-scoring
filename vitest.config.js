import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom so DOM-facing tests run headless; pure-logic tests import app.js
    // without needing a real browser.
    environment: "jsdom",
    include: ["**/*.test.js"],
    setupFiles: ["./test-setup.js"],
  },
});
