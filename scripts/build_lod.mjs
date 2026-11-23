// LOD builds for the hero buildings (from the scaled raw meshes in build/raw/, see build_models.mjs):
//   HIGH -> public/models/hi/<name>.glb : ~300k tris max, 2k maps, error-first simplify, lockBorder
//   LOW  -> public/models/<name>.glb    : the map budget, 1k maps, error-first simplify, lockBorder
// Usage: node scripts/build_lod.mjs [high|low|both] [name ...]
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'

const LOD = ['reciters', 'library', 'learning', 'courtyard_complex', 'community', 'gateway_interior', 'hall_arch_wall']
const [which = 'both', ...names] = process.argv.slice(2)
const list = names.length ? names : LOD
const cfg = JSON.parse(readFileSync('scripts/models.json', 'utf8')).models
const reportPath = 'build/lod_report.json'
const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : {}

// quality first: the smallest relative error that fits the budget
const HIGH_ERRORS = '0.0002,0.0003,0.0004,0.0006,0.0008,0.0012,0.0018,0.0025'
const LOW_ERRORS = '0.001,0.0015,0.002,0.003,0.004,0.006,0.008,0.012,0.02'

function run(name, budget, tex, env) {
  const out = execFileSync(process.execPath, ['scripts/compress.mjs', name, String(budget), String(tex)], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(out.split('\n').find((l) => l.startsWith('COMPRESS ')).slice(9))
}

for (const name of list) {
  const m = cfg.find((c) => c.out === name)
  report[name] ??= {}
  if (which !== 'low') {
    const t0 = Date.now()
    const c = run(name, 300000, 2048, { OUT_DIR: 'public/models/hi', LOCK_BORDER: '1', ERRORS: HIGH_ERRORS, NO_FALLBACK: '1' })
    const mb = statSync(`public/models/hi/${name}.glb`).size / 1048576
    report[name].high = { tris: c.after, error: c.error, mb: +mb.toFixed(2) }
    console.log(`HIGH ${name}: ${c.before} -> ${c.after} tris (error ${c.error}), ${mb.toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }
  if (which !== 'high') {
    const t0 = Date.now()
    const c = run(name, m.tris, 1024, { LOCK_BORDER: '1', ERRORS: LOW_ERRORS })
    const mb = statSync(`public/models/${name}.glb`).size / 1048576
    report[name].low = { tris: c.after, error: c.error, mb: +mb.toFixed(2) }
    console.log(`LOW  ${name}: ${c.before} -> ${c.after} tris (error ${c.error}), ${mb.toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 1))
}
console.log('LOD_DONE')
