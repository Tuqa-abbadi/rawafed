// Real wheel scrolling through the story: start -> map handoff -> scroll back up -> start again.
// Usage: node scripts/scroll_test.mjs [url]
import { chromium } from '@playwright/test'
const url = process.argv[2] ?? 'http://localhost:3000'
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(url)
await page.waitForSelector('.loader.is-done', { timeout: 240000 })
await page.waitForTimeout(3000)
const nav = () => page.evaluate(() => getComputedStyle(document.querySelector('.top-nav')).visibility)
await page.mouse.move(640, 360)
for (let i = 0; i < 60; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(60) }
await page.waitForFunction(() => getComputedStyle(document.querySelector('.top-nav')).visibility === 'visible', null, { timeout: 300000 })
console.log('scrolled down -> top nav visible (map):', await nav())
await page.screenshot({ path: 'screens/scroll_test_map.png', timeout: 240000 })
for (let i = 0; i < 70; i++) { await page.mouse.wheel(0, -400); await page.waitForTimeout(60) }
await page.waitForFunction(() => getComputedStyle(document.querySelector('.top-nav')).visibility === 'hidden' && document.querySelector('.hero__title'), null, { timeout: 300000 })
await page.waitForTimeout(4000)
console.log('scrolled back up -> nav hidden, hero title present:', await nav(), await page.locator('.hero__title').count())
await page.screenshot({ path: 'screens/scroll_test_back.png', timeout: 240000 })
await page.locator('.skip-btn').click()
await page.waitForFunction(() => getComputedStyle(document.querySelector('.top-nav')).visibility === 'visible', null, { timeout: 300000 })
console.log('skip -> map:', await nav())
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors')
await browser.close()
