// Stage 2 batch: Blender (scripts/optimize_model.py) -> build/raw/<name>.glb
//                gltf-transform optimize (meshopt + webp, max tex size) -> public/models/<name>.glb
// Usage: node scripts/build_models.mjs [name ...]   (no names = all models in scripts/models.json)
//        SKIP_BLENDER=1 to only re-run the compression step.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BLENDER = 'D:\\blender.exe' // see CLAUDE.md "Blender"
const cfg = JSON.parse(readFileSync('scripts/models.json', 'utf8')).models
const only = process.argv.slice(2)
const list = only.length ? cfg.filter((m) => only.includes(m.out)) : cfg
mkdirSync('public/models', { recursive: true })
const reportPath = 'build/report.json'
const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : {}

for (const m of list) {
  const t0 = Date.now()
  const srcBytes = statSync(path.join('assets', m.src)).size
  let r = report[m.out] ?? {}
  if (!process.env.SKIP_BLENDER) {
    process.stdout.write(`blender  ${m.out} ... `)
    const out = execFileSync(BLENDER, ['-b', '--factory-startup', '-P', 'scripts/optimize_model.py', '--', ROOT, m.out], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    })
    const line = out.split('\n').find((l) => l.startsWith('RESULT '))
    if (!line) { console.log('FAILED'); console.log(out.slice(-3000)); continue }
    r = JSON.parse(line.slice(7))
    console.log(`${r.tris_before} -> ${r.tris_after} tris (${r.seconds}s)`)
  }
  const tex = String(m.tex ?? 1024)
  const cout = execFileSync(process.execPath, ['scripts/compress.mjs', m.out, String(m.tris ?? 0), tex], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
  const c = JSON.parse(cout.split('\n').find((l) => l.startsWith('COMPRESS ')).slice(9))
  r.tris_after = c.after
  r.simplify_error = c.error
  console.log(`  simplify ${c.before} -> ${c.after} (budget ${c.budget}, error ${c.error})`)
  r.src_bytes = srcBytes
  r.out_bytes = statSync(`public/models/${m.out}.glb`).size
  r.tex = Number(tex)
  report[m.out] = r
  writeFileSync(reportPath, JSON.stringify(report, null, 1))
  console.log(`  -> public/models/${m.out}.glb ${(r.out_bytes / 1048576).toFixed(2)} MB  (${((Date.now() - t0) / 1000).toFixed(0)}s total)`)
}
console.log('BUILD_DONE')
