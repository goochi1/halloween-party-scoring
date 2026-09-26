// Build script: generates a non-module browser bundle (app.browser.js) from the
// ES module app.js by stripping leading `export ` keywords. app.js has no
// `import` statements and is fully self-contained, so removing the `export `
// tokens turns every top-level `export const`/`export function` into a plain
// global and yields a valid classic (non-module) script. The bootstrap at the
// bottom of app.js (guarded by document.readyState / DOMContentLoaded) runs on
// load, so a classic <script> tag initializes the app when index.html is opened
// directly from the filesystem (file://), where ES modules are blocked by CORS.
//
// Run: npm run build

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, "app.js");
const OUTPUT = join(here, "app.browser.js");

const source = readFileSync(SOURCE, "utf8");

if (/^\s*import\s/m.test(source)) {
  console.error(
    "ERROR: app.js contains an `import` statement. The export-stripping bundle " +
      "approach only works for a self-contained module with no imports. Aborting."
  );
  process.exit(1);
}

// Strip leading `export ` on top-level declarations: "export const" -> "const",
// "export function" -> "function", "export class" -> "class", etc.
const stripped = source.replace(/^export\s+/gm, "");

const header =
  "// AUTO-GENERATED from app.js — do not edit. Run: npm run build\n";

writeFileSync(OUTPUT, header + stripped, "utf8");

console.log("Wrote " + OUTPUT + " (" + (header.length + stripped.length) + " bytes)");
