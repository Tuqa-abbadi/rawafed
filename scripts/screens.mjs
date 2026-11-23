// Playwright screenshots of the running site into screens/.
// Usage: node scripts/screens.mjs <name> [url]   (site must be running, default http://localhost:3000)
// Captures: <name>_loading.png (early), <name>_desktop.png, <name>_mobile.png and <name>_169.png (1280x720) after load.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const name = process.argv[2] ?? 'shot'
const url = process.argv[3] ?? 'http://localhost:3000'
mkdirSync('screens', { recursive: true })

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const errors = []

// ONLY=169,mobile limits the shots (faster iteration)
const only = process.env.ONLY?.split(',')
async function shoot(viewport, suffix, { early = false } = {}) {
  if (only && !only.includes(suffix)) return
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${suffix}] ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`[${suffix}] ${e.message}`))
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  if (early) {
    await page.waitForSelector('.loader', { timeout: 30000 })
    await page.waitForTimeout(300)
  } else {
    await page.waitForSelector('.loader.is-done', { timeout: 240000 })
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.loader')).visibility === 'hidden', null, { timeout: 30000 })
    await page.waitForTimeout(Number(process.env.WAIT ?? 1000))
  }
  await page.screenshot({ path: `screens/${name}_${suffix}.png`, timeout: 240000 }) // software GL can take a while per frame
  await page.close()
}

await shoot({ width: 1440, height: 900 }, 'loading', { early: true })
await shoot({ width: 1440, height: 900 }, 'desktop')
await shoot({ width: 390, height: 844 }, 'mobile')
await shoot({ width: 1280, height: 720 }, '169') // same aspect as the reference video, for screens/compare/
await browser.close()

console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join('\n')}` : 'no console errors')
