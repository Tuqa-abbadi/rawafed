// Clicks the hero CTA and checks the flight lands on the map (phase via the map title).
// Usage: node scripts/cta_test.mjs [url]
import { chromium } from '@playwright/test'
const url = process.argv[2] ?? 'http://localhost:3000'
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(url)
await page.waitForSelector('.loader.is-done', { timeout: 240000 })
await page.waitForFunction(() => getComputedStyle(document.querySelector('.hero__cta')).visibility === 'visible', null, { timeout: 120000 })
const t0 = Date.now()
await page.click('.hero__cta')
await page.waitForSelector('.map-intro__title', { timeout: 240000 })
console.log(`map reached ${((Date.now() - t0) / 1000).toFixed(1)} s after the click`)
await page.waitForTimeout(3000)
await page.screenshot({ path: 'screens/stage4_cta_landed.png', timeout: 240000 })
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors')
await browser.close()
