/**
 * Patches @xenova/transformers/src/env.js so that isEmpty(null) returns true
 * instead of throwing "Cannot convert undefined or null to object".
 *
 * Root cause: Turbopack stubs Node.js built-in `fs` to null in browser /
 * Worker bundles.  The library calls Object.keys(fs) at module-evaluation
 * time to detect the runtime, which throws when fs is null.  Adding a
 * `!obj ||` guard makes the check safe without changing its semantics.
 */

const fs = require("fs");
const path = require("path");

const target = path.resolve(
  __dirname,
  "../node_modules/@xenova/transformers/src/env.js"
);

if (!fs.existsSync(target)) {
  console.log("[patch-transformers] target not found, skipping:", target);
  process.exit(0);
}

const original = "return Object.keys(obj).length === 0;";
const patched  = "return !obj || Object.keys(obj).length === 0;";

let content = fs.readFileSync(target, "utf8");

if (content.includes(patched)) {
  console.log("[patch-transformers] already patched, nothing to do.");
  process.exit(0);
}

if (!content.includes(original)) {
  console.warn("[patch-transformers] expected string not found — skipping.");
  process.exit(0);
}

content = content.replace(original, patched);
fs.writeFileSync(target, content, "utf8");
console.log("[patch-transformers] patched isEmpty() in env.js ✓");
