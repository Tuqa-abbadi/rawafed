// Debug helper: load a page, wait, print computed style of selectors.
// Usage: node scripts/probe_dom.mjs <url> <waitMs> <selector> [selector ...]
import { chromium } from '@playwright/test'
const [url, wait, ...sels] = process.argv.slice(2)
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
p.on('pageerror', (e) => console.log('PAGEERROR', e.message))
p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()))
await p.goto(url, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(Number(wait))
for (const s of sels) {
  const r = await p.evaluate((s) => [...document.querySelectorAll(s)].map((el) => {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return { vis: cs.visibility, op: cs.opacity, filter: cs.filter, color: cs.color, box: [r.x, r.y, r.width, r.height].map(Math.round), text: el.textContent?.slice(0, 30) }
  }), s)
  console.log(s, JSON.stringify(r))
}
await b.close()
