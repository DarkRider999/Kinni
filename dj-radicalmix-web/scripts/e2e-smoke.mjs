// Smoke-tests the built app in a real browser: starts the (real, compiled)
// audio engine, imports tracks, checks BPM/key detection and the RadicalAI
// advisor, loads a deck, plays it, and exercises the sampler/FX/settings
// screens. Run `npm run build && npm run preview` first (or `npm run e2e`,
// which does both), then this script.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(DIR, "fixtures");
const OUT = path.join(DIR, ".e2e-out");
const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173/";
fs.mkdirSync(OUT, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`);
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: true });
try {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "01-home.png") });
  assert((await page.title()) === "DJ RadicalMix", "page title");

  // Enter the booth: starts the AudioContext and loads the real wasm engine.
  await page.click("text=Enter the Booth");
  await page.waitForSelector("text=Decks & Mixer", { state: "visible" });
  await page.waitForFunction(
    () => /WebAssembly|JavaScript/.test(document.querySelector(".status")?.textContent ?? ""),
    { timeout: 15000 },
  );
  const statusText = await page.textContent(".status");
  console.log("engine status:", statusText);
  assert(statusText.includes("WebAssembly") || statusText.includes("JavaScript"), "engine mode reported");

  await page.click("text=Decks & Mixer");
  await page.waitForSelector("text=No track loaded");
  await page.screenshot({ path: path.join(OUT, "02-decks.png") });

  // Import two synthetic tracks (128 BPM C major, 130 BPM A minor -- see
  // scripts/fixtures/make-fixtures.py) and check real BPM/key detection.
  await page.click("text=Library & RadicalAI");
  const fileInput = page.locator('input[type=file][accept="audio/*"][multiple]');
  await fileInput.setInputFiles([
    path.join(FIXTURES, "trackA_128_Cmaj.wav"),
    path.join(FIXTURES, "trackB_130_Amin.wav"),
  ]);
  await page.waitForFunction(() => document.querySelectorAll(".tracklist tbody tr").length >= 2, { timeout: 20000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "03-library.png") });

  const rows = await page.$$eval(".tracklist tbody tr", (trs) =>
    trs.map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => td.textContent?.trim())),
  );
  console.log("library rows:", JSON.stringify(rows));
  const byName = Object.fromEntries(rows.map((r) => [r[0], r]));
  const bpmA = parseFloat(byName["trackA_128_Cmaj"][1]);
  const bpmB = parseFloat(byName["trackB_130_Amin"][1]);
  assert(Math.abs(bpmA - 128) < 3, `trackA BPM detected near 128, got ${bpmA}`);
  assert(Math.abs(bpmB - 130) < 3, `trackB BPM detected near 130, got ${bpmB}`);
  assert(byName["trackA_128_Cmaj"][2] === "8B", `trackA key detected as C major (8B), got ${byName["trackA_128_Cmaj"][2]}`);
  assert(byName["trackB_130_Amin"][2] === "8A", `trackB key detected as A minor (8A), got ${byName["trackB_130_Amin"][2]}`);

  const suggestionText = (await page.textContent(".suggestion"))?.replace(/\s+/g, " ").trim();
  console.log("top AI suggestion:", suggestionText);
  assert(suggestionText && suggestionText.length > 0, "RadicalAI produced a suggestion");

  // Smart crate: BPM >= 129 should match only trackB (130.8), not trackA (128.0).
  await page.click("text=+ Smart");
  await page.fill('input[placeholder="e.g. Peak-Time Techno"]', "Fast");
  await page.fill('input[placeholder="min"] >> nth=0', "129");
  await page.click("text=Create");
  await page.click("text=/Fast \\(/");
  await page.waitForTimeout(200);
  const fastCrateRows = await page.$$eval(".tracklist tbody tr", (trs) => trs.map((tr) => tr.textContent));
  assert(fastCrateRows.length === 1 && fastCrateRows[0].includes("trackB_130_Amin"), `smart crate filtered to trackB only, got: ${JSON.stringify(fastCrateRows)}`);
  await page.screenshot({ path: path.join(OUT, "03b-smart-crate.png") });

  // Manual crate: create one, add trackA via its row checkbox, confirm the count updates.
  await page.click("text=All tracks");
  page.once("dialog", (d) => d.accept("Openers"));
  await page.click("text=+ Manual");
  await page.waitForTimeout(100);
  await page.click("text=/Openers \\(/");
  await page.waitForSelector('.tracklist thead th:has-text("In crate")');
  await page.locator(".tracklist tbody tr", { hasText: "trackA_128_Cmaj" }).locator('input[type=checkbox]').check();
  await page.waitForFunction(() => /Openers \(1\)/.test(document.querySelector(".crate-rail")?.textContent ?? ""), {
    timeout: 5000,
  });
  await page.click("text=All tracks");

  // Load trackA onto Deck A (by name, not row position -- library order isn't
  // guaranteed) and verify the Decks screen reflects it.
  await page
    .locator(".tracklist tbody tr", { hasText: "trackA_128_Cmaj" })
    .getByRole("button", { name: "A", exact: true })
    .click();
  await page.click("text=Decks & Mixer");
  await page.waitForSelector("text=trackA_128_Cmaj", { timeout: 10000 });
  await page.waitForTimeout(300); // let the waveform's useEffect paint the canvas
  await page.screenshot({ path: path.join(OUT, "04-deck-loaded.png") });

  // Waveform: the deck with a track loaded should have drawn non-empty bars;
  // the deck with nothing loaded should not.
  const waveformPixels = await page.$$eval(".deck canvas", (canvases) =>
    canvases.map((c) => {
      const ctx = c.getContext("2d");
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let nonTransparent = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) nonTransparent++;
      return nonTransparent;
    }),
  );
  console.log("waveform canvas drawn-pixel counts:", waveformPixels);
  assert(waveformPixels[0] > 100, `deck A (loaded) waveform has drawn pixels, got ${waveformPixels[0]}`);

  // Press play on the deck that has trackA loaded, and confirm the
  // transport + engine state actually changed.
  const deckWithTrackA = page.locator(".deck", { hasText: "trackA_128_Cmaj" });
  await deckWithTrackA.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll(".deck button.btn.primary")).some((b) => b.textContent === "Pause"),
    { timeout: 5000 },
  );
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "05-playing.png") });

  // Sampler: trigger a pad and confirm it loaded (not disabled).
  await page.click("text=Sampler");
  await page.waitForSelector(".pad:not([disabled])", { timeout: 10000 });
  await page.locator(".pad").first().click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "06-sampler.png") });

  await page.click("text=FX Rack");
  await page.waitForSelector("text=Performance macros");
  await page.screenshot({ path: path.join(OUT, "07-fx.png") });

  await page.click("text=Settings");
  await page.waitForSelector("text=Engine");
  await page.screenshot({ path: path.join(OUT, "08-settings.png") });

  // Recording: start, let it capture a moment of real (playing) audio, stop,
  // and confirm both the audio and the auto-built tracklist are downloadable.
  await page.click("text=Start recording");
  await page.waitForTimeout(1000);
  await page.click("text=Stop recording");
  await page.waitForSelector("text=Download audio (.webm)", { timeout: 5000 });
  await page.waitForSelector("text=Download tracklist (.txt)", { timeout: 5000 });
  const tracklistHref = await page.getAttribute("text=Download tracklist (.txt)", "href");
  const tracklistText = await page.evaluate((url) => fetch(url).then((r) => r.text()), tracklistHref);
  console.log("tracklist contents:", JSON.stringify(tracklistText));
  assert(tracklistText.includes("trackA_128_Cmaj"), "tracklist mentions the loaded track");
  await page.screenshot({ path: path.join(OUT, "09-recorded.png") });

  assert(consoleErrors.length === 0, `no console errors, got: ${JSON.stringify(consoleErrors)}`);

  console.log(`\nPASS -- screenshots in ${OUT}`);
} finally {
  await browser.close();
}
