// Full-quality builds straight from the ORIGINAL Meshy files (assets/), no Blender round trip:
// the source normals, UVs and every PBR map stay exactly as Meshy made them.
//   - bake node transforms, then scale to real size + base-centre origin (same size/placement as the
//     Stage 2 config in scripts/models.json; a `trim` box is only used to FRAME the model — nothing
//     is cut or deleted, courtyard_complex keeps its grass base, learning keeps its baked people)
//   - simplify only above LIGHT_ABOVE triangles: meshopt, lockBorder, a small error threshold
//     (silhouette + carved edges preserved), never a ratio target
//   - flipped faces are NOT deleted: models listed in DOUBLE_SIDED get double-sided materials
//   - WebP maps at TEX px (normal maps at higher quality), meshopt geometry compression
// Usage: node scripts/build_full.mjs [name ...]      Env: ERROR (default 0.0002), TEX (default 2048)
import { NodeIO, getBounds } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { clearNodeTransform, dedup, flatten, join, meshopt, prune, simplify, textureCompress, transformMesh, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { applyMaterialFixes } from './materials.mjs'

const FULL = ['reciters', 'library', 'learning', 'courtyard_complex', 'community', 'gateway_interior', 'hall_arch_wall', 'arcade_bay']
// faces wound inward in the Meshy source (scripts/check_mesh.py): learning 0.46%, reciters 0.45%, library 0.23%
const DOUBLE_SIDED = new Set(['learning', 'reciters', 'library'])
const LIGHT_ABOVE = Number(process.env.LIGHT_ABOVE ?? 500_000)
const ERROR = Number(process.env.ERROR ?? 0.0002)
const TEX = Number(process.env.TEX ?? 2048)

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready])
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
const cfgs = JSON.parse(readFileSync('scripts/models.json', 'utf8')).models
const names = process.argv.slice(2).length ? process.argv.slice(2) : FULL
const reportPath = 'build/full_report.json'
const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : {}

const tris = (doc) => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0)

for (const name of names) {
  const cfg = cfgs.find((c) => c.out === name)
  const t0 = Date.now()
  const doc = await io.read(`assets/${cfg.src}`)
  await doc.transform(dedup(), flatten(), join())
  for (const node of doc.getRoot().listNodes()) if (node.getMesh()) clearNodeTransform(node)
  const before = Math.round(tris(doc))

  // bounds (glTF Y-up). A Stage 2 trim box [x0,x1,y0,y1] was in Blender Z-up coords: y_blender = -z_gltf.
  let mn, mx
  if (cfg.trim) {
    const [x0, x1, y0, y1] = cfg.trim
    mn = [Infinity, Infinity, Infinity]; mx = [-Infinity, -Infinity, -Infinity]
    const v = [0, 0, 0]
    for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION')
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v)
        if (v[0] < x0 || v[0] > x1 || -v[2] < y0 || -v[2] > y1) continue
        for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]) }
      }
    }
  } else {
    const b = getBounds(doc.getRoot().listScenes()[0]); mn = b.min; mx = b.max
  }
  const d = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]]
  const measured = { xy: Math.max(d[0], d[2]), x: d[0], y: d[2], z: d[1] }[cfg.size.dim]
  const s = cfg.size.m / measured
  const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2
  // M = scale(s) * translate(-cx, -minY, -cz)   (column-major 4x4)
  const M = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, -cx * s, -mn[1] * s, -cz * s, 1]
  for (const mesh of doc.getRoot().listMeshes()) transformMesh(mesh, M)

  let error = null
  if (before > LIGHT_ABOVE) {
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0, error: ERROR, lockBorder: true }))
    error = ERROR
  }
  const after = Math.round(tris(doc))
  applyMaterialFixes(doc, cfg)
  if (DOUBLE_SIDED.has(name)) for (const m of doc.getRoot().listMaterials()) m.setDoubleSided(true)

  await doc.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX], quality: 94, slots: /^normalTexture$/ }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX], quality: 85, slots: /^(?!normalTexture$).*/ }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  )
  const out = `public/models/${name}.glb`
  await io.write(out, doc)
  const mb = statSync(out).size / 1048576
  const maps = doc.getRoot().listMaterials().map((m) => ['base', m.getBaseColorTexture(), 'normal', m.getNormalTexture(), 'mr', m.getMetallicRoughnessTexture(), 'occ', m.getOcclusionTexture()].filter((x, i, a) => typeof x === 'string' && a[i + 1]).join('+'))
  report[name] = { before, after, error, tex: TEX, mb: +mb.toFixed(2), maps, doubleSided: DOUBLE_SIDED.has(name), scale: +s.toFixed(4) }
  writeFileSync(reportPath, JSON.stringify(report, null, 1))
  console.log(`FULL ${name}: ${before.toLocaleString()} -> ${after.toLocaleString()} tris (error ${error ?? 'none'}), maps ${maps.join(' / ')}, ${mb.toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}
console.log('FULL_DONE')
