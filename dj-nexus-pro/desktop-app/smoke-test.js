// CI smoke test: launches the built app, starts the engine and checks that the
// demo decks load, get analysed and play. Usage: node smoke-test.js <app executable>
const { _electron } = require("playwright-core");

(async () => {
  const exe = process.argv[2];
  const app = await _electron.launch({ executablePath: exe, args: ["--no-sandbox", ...process.argv.slice(3)], timeout: 120000 });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForSelector("#go", { timeout: 60000 });
  console.log("window:", await page.title());
  await page.click("#go");
  await page.waitForSelector("#start", { state: "detached", timeout: 180000 });
  const mode = await page.textContent("#chip-mode");
  console.log("engine:", mode);
  if (!/WebAssembly|JavaScript/.test(mode)) throw new Error("engine did not start: " + mode);
  await page.waitForFunction(() => /\d+[AB] ·/.test(document.querySelector("#sub0").textContent), null, { timeout: 120000 });
  console.log("deck A:", await page.textContent("#sub0"));
  await page.click("#play0");
  await page.waitForTimeout(3000);
  const time = await page.textContent("#time0");
  console.log("deck A remaining:", time);
  if (time.trim() === "-2:30.0") throw new Error("deck A did not advance");
  await page.click("#midi-connect");
  await page.waitForTimeout(2000);
  console.log("midi:", await page.textContent("#midi-msg"));
  await page.screenshot({ path: "smoke.png" });
  await app.close();
  if (errors.length) throw new Error("page errors: " + errors.join(" | "));
  console.log("smoke test passed");
})().catch((e) => {
  console.error("SMOKE TEST FAILED:", e.message);
  process.exit(1);
});
