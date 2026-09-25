// Copies the Deck Lab page, the WebAssembly engine and its runtime from the
// engine's browser build, so the desktop app always ships the current engine.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "engine", "web");
const dst = path.join(__dirname, "decklab");
const files = ["index.html", "djnexus.wasm", "djnexus-asm.js", "djnexus-runtime.js", "djnexus-worklet.js", "djnexus-analyzer.js"];

fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
for (const f of files) fs.copyFileSync(path.join(src, f), path.join(dst, f));
console.log(`copied ${files.length} files to ${dst}`);
