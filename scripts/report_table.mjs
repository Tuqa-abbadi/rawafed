// Prints the Stage 2 before/after table (markdown) from build/report.json + load-group totals.
import { readFileSync, statSync, existsSync } from 'node:fs'

const r = JSON.parse(readFileSync('build/report.json', 'utf8'))
const cfg = JSON.parse(readFileSync('scripts/models.json', 'utf8')).models
const mb = (b) => (b / 1048576).toFixed(2)
const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n))

// What the first screen needs (hero), vs. what can stream in while the hero plays (map + rest).
const groups = {
  hero: ['gateway_interior', 'arcade_bay', 'olive_tree', 'walker', 'tower_supertall', 'tower_twist', 'tower_slim', 'tower_stepped', 'tower_twin', 'tower_residential', 'dhow', 'yacht', 'palm'],
  map: ['reciters', 'community', 'library', 'learning', 'courtyard_complex', 'domed_hall', 'pavilion_small', 'minaret', 'bridge', 'pergola', 'fountain', 'lantern'],
  later: ['hall_arch_wall', 'lantern_hi', 'reciter_old', 'reciter_young', 'rehal', 'majlis', 'bookshelf', 'reading_desk', 'class_desk', 'gateway_portal'],
}
console.log('| Model | Budget | Tris before | Tris after | Size before | Size after | Real size (w×d×h m) |')
console.log('|---|---:|---:|---:|---:|---:|---|')
let tb = 0, ta = 0, sb = 0, sa = 0
for (const m of cfg) {
  const x = r[m.out]
  if (!x || !existsSync(`public/models/${m.out}.glb`)) { console.log(`| ${m.out} | – | – | – | – | – | NOT BUILT |`); continue }
  const out = statSync(`public/models/${m.out}.glb`).size
  const over = m.tris && x.tris_after > m.tris * 1.03 ? ' ⚠' : ''
  console.log(`| ${m.out} | ${m.tris ? k(m.tris) : 'rigged'} | ${k(x.tris_before)} | ${k(x.tris_after)}${over} | ${mb(x.src_bytes)} MB | ${mb(out)} MB | ${(x.dims_m ?? []).join(' × ')} |`)
  tb += x.tris_before; ta += x.tris_after; sb += x.src_bytes; sa += out
}
console.log(`| **Total** | | **${k(tb)}** | **${k(ta)}** | **${mb(sb)} MB** | **${mb(sa)} MB** | |`)
for (const [g, names] of Object.entries(groups)) {
  const s = names.reduce((a, n) => a + (existsSync(`public/models/${n}.glb`) ? statSync(`public/models/${n}.glb`).size : 0), 0)
  console.log(`${g}: ${mb(s)} MB`)
}
const env = ['public/env/sunset_2k.hdr', 'public/env/sky_4k.jpg', 'public/logo.svg'].reduce((a, f) => a + statSync(f).size, 0)
console.log(`env+logo: ${mb(env)} MB`)
