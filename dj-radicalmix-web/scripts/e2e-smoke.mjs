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

  // Auto cue points: loading a track (no manual action) should already have
  // set hot cues 1-3 to the detected intro/drop/outro positions. Trigger hot
  // cue 1 ("Intro") via its keyboard shortcut and confirm the playhead
  // actually jumped to a specific, non-zero position -- not just that the
  // button exists, but that djn_deck_hot_cue_set_at really ran on load.
  await page.keyboard.press("1");
  await page.waitForTimeout(150);
  const introCuePosition = await page.evaluate(() => window.__djEngine.state.decks[0].position);
  console.log("auto intro-cue jumped deck A to:", introCuePosition);
  assert(introCuePosition > 0, `hot cue 1 (auto-set "Intro") jumped to a real position, got ${introCuePosition}`);

  // Triggering the hot cue above already started playback: a hot-cue
  // trigger on a paused deck jumps to the cue AND plays, same as a real
  // CDJ/Serato pad (see Deck::hotCueTrigger). So there's no separate "Play"
  // button to click here -- just confirm the transport reflects it.
  const deckWithTrackA = page.locator(".deck", { hasText: "trackA_128_Cmaj" });
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll(".deck button.btn.primary")).some((b) => b.textContent === "Pause"),
    { timeout: 5000 },
  );
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "05-playing.png") });

  // Hot cue marker: set one on deck A, then confirm the waveform actually
  // drew the amber marker (#ffb020) somewhere on the canvas.
  await deckWithTrackA.locator("text=Set mode").click();
  await deckWithTrackA.locator(".hotcue", { hasText: "1" }).click();
  await page.waitForTimeout(200);
  const hasHotCueMarker = await deckWithTrackA.locator("canvas").evaluate((c) => {
    const ctx = c.getContext("2d");
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 240 && data[i + 1] > 160 && data[i + 1] < 200 && data[i + 2] < 60) return true;
    }
    return false;
  });
  assert(hasHotCueMarker, "hot cue marker (amber) was drawn on the waveform");
  await deckWithTrackA.locator("text=Tap to set").click(); // leave "set mode" off again

  // Keyboard shortcut: Space should toggle deck A's play state.
  const playLabelBefore = await deckWithTrackA.getByRole("button", { name: /Play|Pause/, exact: true }).textContent();
  await page.keyboard.press(" ");
  await page.waitForTimeout(300);
  const playLabelAfter = await deckWithTrackA.getByRole("button", { name: /Play|Pause/, exact: true }).textContent();
  assert(playLabelBefore !== playLabelAfter, `Space toggled deck A's transport (was "${playLabelBefore}")`);
  await page.keyboard.press(" "); // toggle back to playing, for the Auto-Mix test below
  await page.waitForTimeout(300);

  // Next-Track Radar: the Decks screen itself should show a live suggestion
  // (not just the Library tab's copy of the same panel).
  await page.waitForSelector("text=Next-Track Radar");
  const radarSuggestion = await page.locator(".suggestion").first().isVisible();
  assert(radarSuggestion, "Next-Track Radar shows a suggestion on the Decks screen");

  // Auto-Mix: both test fixtures are 15s long (shorter than the 20s trigger
  // window), so enabling it with deck A already playing should immediately
  // pick trackB (the only other track), load it to the idle deck, play it,
  // and crossfade into it.
  await page.locator(".row", { hasText: "Auto-Mix" }).getByRole("button").click();
  await page.waitForFunction(
    () => {
      const e = window.__djEngine;
      const st = e?.state;
      return st && st.decks[1].loaded === 1 && st.decks[1].playing === 1;
    },
    { timeout: 10000 },
  );
  console.log("Auto-Mix: deck B loaded and playing");
  await page.waitForFunction(
    () => parseFloat(document.querySelector(".xfader")?.value ?? "0") > 0.9,
    { timeout: 15000 },
  );
  const finalCrossfader = await page.locator(".xfader").inputValue();
  console.log("Auto-Mix: crossfader settled at", finalCrossfader);
  assert(parseFloat(finalCrossfader) > 0.9, `Auto-Mix crossfaded to deck B, crossfader=${finalCrossfader}`);
  await page.screenshot({ path: path.join(OUT, "05b-automix.png") });

  // Sampler: trigger a pad and confirm it loaded (not disabled).
  await page.click("text=Sampler");
  await page.waitForSelector(".pad:not([disabled])", { timeout: 10000 });
  await page.locator(".pad").first().click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "06-sampler.png") });

  await page.click("text=FX Rack");
  await page.waitForSelector("text=Performance macros");

  // Smart FX: one tap should select the right type, turn the unit on, and
  // actually apply it to the engine (checked via engine state, not just the
  // dropdown -- the dropdown reflects React state, the FX unit's `on`/`type`
  // in engine state reflects what the audio engine actually has active).
  const fx1 = page.locator(".panel", { hasText: "FX 1" });
  await fx1.locator("text=Smart Flanger").click();
  await page.waitForTimeout(150);
  await page.waitForFunction(() => {
    const fx = window.__djEngine.state.fx[0];
    return fx.on === 1 && fx.type === 4; // djn_fx_type FLANGER = 4
  });
  assert((await fx1.locator("select").first().inputValue()) === "4", "FX 1's Type dropdown shows Flanger after Smart Flanger");

  const fx2 = page.locator(".panel", { hasText: "FX 2" });
  await fx2.locator("text=Smart Reverb").click();
  await page.waitForTimeout(150);
  await page.waitForFunction(() => {
    const fx = window.__djEngine.state.fx[1];
    return fx.on === 1 && fx.type === 3; // djn_fx_type REVERB = 3
  });
  console.log("Smart FX: flanger on FX1, reverb on FX2, both confirmed in engine state");
  await page.screenshot({ path: path.join(OUT, "07-fx.png") });

  await page.click("text=Settings");
  await page.waitForSelector("text=Engine");
  // Web MIDI isn't available in this headless Chromium build (no
  // navigator.requestMIDIAccess) -- confirms the graceful-fallback path the
  // real UI also takes in Safari/Firefox, which don't support it either.
  await page.waitForSelector("text=MIDI controller");
  const midiSupported = await page.evaluate(() => typeof navigator.requestMIDIAccess === "function");
  console.log("Web MIDI supported in this browser:", midiSupported);
  if (!midiSupported) {
    await page.waitForSelector("text=Web MIDI isn't available in this browser");
  } else {
    await page.waitForSelector("text=Devices:");
  }
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
