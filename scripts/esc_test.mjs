// ?at=<rafid> then Esc; screenshot once the map has settled. Prints the store-visible state.
import { chromium } from '@playwright/test'
const url = process.argv[2] ?? 'http://localhost:3001'
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.goto(`${url}/?at=library`)
await page.waitForSelector('.loader.is-done', { timeout: 240000 })
await page.waitForFunction(() => getComputedStyle(document.querySelector('.side-panel')).visibility === 'visible', null, { timeout: 240000 })
await page.waitForTimeout(3000)
await page.keyboard.press('Escape')
await page.waitForTimeout(20000)
const n = await page.locator('.map-label.is-on').count()
console.log('labels on:', n)
await page.screenshot({ path: 'screens/s5_esc.png', timeout: 240000 })
await browser.close()
