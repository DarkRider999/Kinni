// Builds nothing itself: run after `vite build`. Serves dist with `vite preview`,
// opens #/design in Chromium, fails on any console error or page error, opens the
// export dialog, and writes full-page reference shots to replica/design/
// (reference only, never shipped).
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../../replica/design')
const port = 4317
const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { cwd: resolve(here, '..'), stdio: 'pipe' })

async function waitForServer(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`preview server did not start at ${url}`)
}

const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
let browser
let failed = false
try {
  await waitForServer(`http://localhost:${port}/`)
  browser = await chromium.launch(executablePath ? { executablePath } : {})
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
  const problems = []
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`))
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))

  await page.goto(`http://localhost:${port}/#/design`)
  await page.getByRole('heading', { name: 'Design system' }).waitFor()
  console.log('crossOriginIsolated:', await page.evaluate(() => crossOriginIsolated))
  await page.screenshot({ path: resolve(outDir, 'gallery.png'), fullPage: true })

  await page.getByRole('button', { name: 'Open export dialog' }).click()
  await page.getByRole('dialog', { name: 'Export video' }).waitFor()
  await page.screenshot({ path: resolve(outDir, 'gallery-export-dialog.png') })
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'detached' })

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
  mobile.on('pageerror', (e) => problems.push(`mobile pageerror: ${e.message}`))
  await mobile.goto(`http://localhost:${port}/#/design`)
  await mobile.getByRole('heading', { name: 'Design system' }).waitFor()
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (overflow > 0) problems.push(`mobile: horizontal overflow of ${overflow}px`)
  await mobile.screenshot({ path: resolve(outDir, 'gallery-mobile.png'), fullPage: true })

  if (problems.length) {
    failed = true
    console.error(problems.join('\n'))
  } else {
    console.log(`design: screenshots written to ${outDir}, no console errors`)
  }
} catch (e) {
  failed = true
  console.error(e)
} finally {
  await browser?.close()
  preview.kill()
  process.exit(failed ? 1 : 0)
}
