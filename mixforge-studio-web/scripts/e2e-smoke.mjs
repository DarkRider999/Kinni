// Smoke-tests the built app in a real browser: starts the Web Audio engine, generates a beat,
// plays it, generates a melody, loads the beat into a DJ deck, mixes it, and previews a sample
// from the library. Run `npm run build && npm run preview` first (or `npm run e2e`, which does
// both), then this script.
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(DIR, '.e2e-out')
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4174/'
fs.mkdirSync(OUT, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`)
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true })
try {
  const page = await browser.newPage()
  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))

  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  assert((await page.title()) === 'MixForge Studio', 'page title')
  await page.screenshot({ path: path.join(OUT, '01-gate.png') })

  // PWA installability: manifest + icons serve, and the service worker activates. This is what
  // makes Chrome/Android offer "Install app" / "Add to Home Screen" since no .apk can be built in
  // this environment (no Android SDK, and the network policy blocks downloading one).
  const manifestHref = await page.getAttribute('link[rel=manifest]', 'href')
  assert(manifestHref === '/manifest.webmanifest', 'manifest link present')
  const manifest = await page.evaluate(async (href) => (await fetch(href)).json(), manifestHref)
  assert(manifest.name === 'MixForge Studio by SplitFire Production', 'manifest name')
  assert(manifest.display === 'standalone', 'manifest display mode')
  assert(manifest.icons.some((i) => i.sizes === '192x192') && manifest.icons.some((i) => i.sizes === '512x512'), 'manifest has 192 + 512 icons')
  for (const icon of manifest.icons) {
    const status = await page.evaluate(async (src) => (await fetch(src)).status, icon.src)
    assert(status === 200, `icon ${icon.src} serves`)
  }
  const swReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null
    const reg = await navigator.serviceWorker.ready
    return !!reg.active
  })
  assert(swReady === true, 'service worker activates')

  await page.click('text=Enter the Studio')
  await page.waitForSelector('text=AI Beat Generator', { state: 'hidden' }).catch(() => {})
  await page.waitForSelector('nav.top-nav')
  await page.screenshot({ path: path.join(OUT, '02-home.png') })

  // Beat Generator: generate, play briefly, stop, save to project.
  await page.click('text=Beat Generator')
  await page.waitForSelector('text=AI Beat Generator')
  await page.click('text=⟳ Regenerate')
  await page.click('button:has-text("Play")')
  await page.waitForTimeout(600)
  const stepOn = await page.locator('.step-cell.on').count()
  assert(stepOn > 0, 'beat pattern has active steps')
  await page.click('button:has-text("Stop")')
  await page.click('text=Keep & Send to Project')
  await page.waitForSelector('text=Saved')
  await page.screenshot({ path: path.join(OUT, '03-beat.png') })

  // Melody Creator: generate, play briefly, stop.
  await page.click('text=Melody')
  await page.waitForSelector('text=Melody & Bassline Creator')
  await page.click('button:has-text("Play")')
  await page.waitForTimeout(600)
  await page.click('button:has-text("Stop")')
  await page.screenshot({ path: path.join(OUT, '04-melody.png') })

  // DJ Mixer: load the saved beat into Deck A, play it, move the crossfader and FX rack.
  await page.click('text=DJ Mixer')
  await page.waitForSelector('text=Deck A')
  await page.locator('.deck-panel select').first().selectOption({ index: 1 })
  await page.waitForFunction(
    () => document.querySelector('.deck-panel p.deck-track-name')?.textContent !== 'Empty',
    { timeout: 10000 },
  )
  await page.locator('.deck-panel button:has-text("▶")').first().click()
  await page.waitForTimeout(400)
  await page.fill('.crossfader-slider', '0.5')
  const fxSliders = page.locator('.deck-panel').first().locator('.fx-slider input')
  assert((await fxSliders.count()) === 4, 'deck has 4 FX sliders (filter/echo/reverb/flanger)')
  await fxSliders.nth(2).fill('0.6') // reverb
  await fxSliders.nth(3).fill('0.4') // flanger
  await page.screenshot({ path: path.join(OUT, '05-mixer.png') })

  // Record a short session, stop it, and confirm it's saved to the project (not just downloaded).
  await page.click('button:has-text("Record")')
  await page.waitForTimeout(900)
  await page.click('button:has-text("Stop Rec")')
  await page.waitForSelector('text=Session saved to project')
  await page.waitForSelector('.session-row')
  const sessionCountAfterRecord = await page.locator('.session-row').count()
  assert(sessionCountAfterRecord === 1, 'recorded session appears in Recorded Sessions')
  const sessionRow = page.locator('.session-row').first()
  await sessionRow.locator('button:has-text("Play")').click()
  await page.waitForTimeout(300)
  assert(await sessionRow.locator('button:has-text("Stop")').isVisible(), 'session preview plays back')
  await sessionRow.locator('button:has-text("Stop")').click()
  await page.screenshot({ path: path.join(OUT, '06-session-recorded.png') })
  await sessionRow.locator('button:has-text("Delete")').click()
  assert((await page.locator('.session-row').count()) === 0, 'deleting a session removes it from the list')

  // Sample Library: 17 one-shots, category/genre/mood filtering, preview playback.
  await page.click('text=Samples')
  await page.waitForSelector('text=Sample Library')
  const sampleCount = await page.locator('.sample-card').count()
  assert(sampleCount === 17, `sample library has 17 one-shots (got ${sampleCount})`)
  await page.selectOption('select', { label: 'Percussion' })
  await page.waitForTimeout(100)
  const percCount = await page.locator('.sample-card').count()
  assert(percCount > 0 && percCount < sampleCount, 'category filter narrows the sample list')
  await page.selectOption('select', { label: 'all' })
  await page.locator('.sample-card').first().click()
  await page.screenshot({ path: path.join(OUT, '07-samples.png') })

  const seriousErrors = consoleErrors.filter((e) => !/favicon/i.test(e))
  assert(seriousErrors.length === 0, `no console errors: ${seriousErrors.join(' | ')}`)

  console.log('E2E smoke test passed.')
} finally {
  await browser.close()
}
