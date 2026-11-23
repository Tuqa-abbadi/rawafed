// Bytes downloaded before the loader finishes (initial load) vs. afterwards (background map).
// Usage: node scripts/load_size.mjs [url]
import { chromium } from '@playwright/test'
const url = process.argv[2] ?? 'http://localhost:3000'
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const files = []
let phase = 'initial'
page.on('requestfinished', async (req) => {
  const s = await req.sizes().catch(() => null)
  files.push({ url: req.url().replace(url, ''), bytes: s ? s.responseBodySize : 0, phase })
})
await page.goto(url)
await page.waitForSelector('.loader.is-done', { timeout: 240000 })
phase = 'background'
await page.waitForTimeout(25000)
// a URL can finish twice (preload + loader share the cache); count each file once, in its first phase
const seen = new Set()
const uniq = files.filter((f) => !seen.has(f.url) && seen.add(f.url))
const sum = (p) => uniq.filter((f) => f.phase === p).reduce((a, f) => a + f.bytes, 0) / 1048576
const models = (p) => uniq.filter((f) => f.phase === p && f.url.includes('/models/')).map((f) => f.url.split('/').pop()).join(' ')
console.log(`initial:    ${sum('initial').toFixed(2)} MB  models: ${models('initial')}`)
console.log(`background: ${sum('background').toFixed(2)} MB  models: ${models('background')}`)
await browser.close()
