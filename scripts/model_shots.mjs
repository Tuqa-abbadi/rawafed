// Screenshots of optimized models in the /models dev viewer.
// Usage: node scripts/model_shots.mjs <outDir> <spec> [spec ...]
//   spec = name[:az[:el[:fov[:dist[:ty[:label]]]]]]   (az 0 = camera on +Z looking -Z)
// Env BASE (default http://localhost:3001), W/H (default 1280x720).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [outDir, ...specs] = process.argv.slice(2)
const BASE = process.env.BASE ?? 'http://localhost:3001'
const W = Number(process.env.W ?? 1280), H = Number(process.env.H ?? 720)
mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: W, height: H } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
for (const spec of specs) {
  const [m, az = '25', el = '18', fov = '40', dist = '1.15', ty = '0.45', label] = spec.split(':')
  const url = `${BASE}/models?m=${m}&az=${az}&el=${el}&fov=${fov}&dist=${dist}&ty=${ty}`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.dev-info[data-ready="true"]', { timeout: 180000 })
  await page.waitForTimeout(1500)
  const file = `${outDir}/${label ?? `${m}_az${az}_el${el}`}.png`
  await page.screenshot({ path: file })
  const info = await page.textContent('.dev-info')
  console.log(file, '|', info)
}
await browser.close()
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors')
