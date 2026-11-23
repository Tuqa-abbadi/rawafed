// Stage 5 flow: map -> click a label -> entrance + panel -> interior -> Esc back to the map.
// Usage: node scripts/s5_flow.mjs [url] [rafid]
import { chromium } from '@playwright/test'
const url = process.argv[2] ?? 'http://localhost:3000'
const rafid = process.argv[3] ?? 'library'
const names = { reciters: 'القرّاء', library: 'المكتبة', learning: 'التعليم', community: 'المجتمع' }
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const shot = (n) => page.screenshot({ path: `screens/s5_flow_${rafid}_${n}.png`, timeout: 240000 })
const t = () => ((Date.now() - t0) / 1000).toFixed(1) + 's'
await page.goto(`${url}/?phase=map`)
await page.waitForSelector('.loader.is-done', { timeout: 240000 })
await page.waitForSelector('.map-label.is-on', { timeout: 240000 })
let t0 = Date.now()
await page.locator('.map-label__pill', { hasText: names[rafid] }).click({ force: true }) // labels sway with the camera: never 'stable'
await page.waitForFunction(() => getComputedStyle(document.querySelector('.side-panel')).visibility === 'visible', null, { timeout: 240000 })
console.log(`panel visible ${t()} after the label click`)
await page.waitForTimeout(1500)
await shot('1_entrance')
if (rafid !== 'reciters') {
  t0 = Date.now()
  await page.locator('.side-panel .btn-gold').click()
  await page.waitForFunction(() => !document.querySelector('.side-panel .btn-gold') , null, { timeout: 240000 })
  await page.waitForTimeout(6000)
  console.log(`interior reached ${t()}`)
  await shot('2_interior')
}
t0 = Date.now()
await page.keyboard.press('Escape')
await page.waitForSelector('.map-label.is-on', { timeout: 240000 })
console.log(`back on the map ${t()} after Esc`)
await page.waitForTimeout(1000)
await shot('3_back')
// top nav: fly to another building directly
t0 = Date.now()
await page.locator('.top-nav__item', { hasText: 'المجتمع' }).click()
await page.waitForFunction(() => getComputedStyle(document.querySelector('.side-panel')).visibility === 'visible', null, { timeout: 240000 })
console.log(`top nav -> المجتمع panel ${t()}`)
await shot('4_nav')
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors')
await browser.close()
