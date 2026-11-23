// Stage 2, step 2: build/raw/<name>.glb -> public/models/<name>.glb
// weld -> meshoptimizer simplify to the triangle budget (smallest error tolerance that reaches it)
// -> textures to WebP (max size) -> meshopt geometry compression.
// Usage: node scripts/compress.mjs <name> <trisBudget|0> <texSize>   (budget 0 = no simplify, e.g. rigged)
// Env (LOD builds):
//   OUT_DIR=public/models/hi   output folder (default public/models)
//   LOCK_BORDER=1              meshopt lockBorder: open borders never move (keeps carved edges / rims)
//   ERRORS=0.0003,0.0005,...   error thresholds tried in order (relative to mesh size); the first one
//                              that fits the budget wins — quality first, never a fixed ratio
//   NO_FALLBACK=1              never use the permissive/sloppy fallbacks (stay over budget instead)
// Prints 'COMPRESS {json}'.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { weld, simplify, textureCompress, meshopt, prune, dedup, flatten, join, compactPrimitive } from '@gltf-transform/functions'
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { applyMaterialFixes } from './materials.mjs'

const [name, budgetArg, texArg] = process.argv.slice(2)
const budget = Number(budgetArg ?? 0)
const tex = Number(texArg ?? 1024)
await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready])
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
})

function tris(doc) {
  let n = 0
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) {
      if (p.getMode() !== 4) continue
      const idx = p.getIndices()
      n += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3
    }
  return Math.round(n)
}

/**
 * Fallback for models made of many small separate pieces (leaves, lattice, windows), where the
 * standard simplifier stops early because every piece edge / UV seam is a locked border.
 * mode 'permissive': meshopt simplify with Permissive (may collapse across seams) + Prune
 *                    (drops tiny disconnected pieces). mode 'sloppy': vertex clustering, hits any target.
 * Vertices are reused, so UVs/normals stay attached; unused vertices are compacted away.
 */
function hardSimplify(doc, target, mode) {
  const total = tris(doc)
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) {
      if (p.getMode() !== 4 || !p.getIndices()) continue
      const idxAcc = p.getIndices()
      const indices = Uint32Array.from(idxAcc.getArray())
      const pos = p.getAttribute('POSITION')
      const positions = pos.getArray() instanceof Float32Array ? pos.getArray() : Float32Array.from(pos.getArray())
      const want = Math.max(3, Math.floor(((indices.length / 3) * target) / total) * 3)
      let out
      const uvAcc = p.getAttribute('TEXCOORD_0')
      if (mode === 'sloppy') {
        ;[out] = MeshoptSimplifier.simplifySloppy(indices, positions, 3, null, want, 1)
      } else if (uvAcc) {
        // UV-aware: penalise collapses that distort the texture layout (avoids the 'crumpled foil' smear)
        const uvs = uvAcc.getArray() instanceof Float32Array ? uvAcc.getArray() : Float32Array.from(uvAcc.getArray())
        const w = Number(process.env.UV_WEIGHT ?? 1.0)
        ;[out] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, uvs, 2, [w, w], null, want, 1, ['Permissive', 'Prune'])
      } else {
        ;[out] = MeshoptSimplifier.simplify(indices, positions, 3, want, 1, ['Permissive', 'Prune'])
      }
      const maxIndex = out.reduce((a, b) => (b > a ? b : a), 0)
      idxAcc.setArray(maxIndex < 65535 ? Uint16Array.from(out) : out)
      compactPrimitive(p)
    }
}

const src = `build/raw/${name}.glb`
let doc = await io.read(src)
const rigged = doc.getRoot().listSkins().length > 0
if (!rigged) await doc.transform(flatten(), join())
await doc.transform(weld())
const before = tris(doc)
let chosenError = null

if (budget && before > budget * 1.03) {
  const raw = await io.writeBinary(doc)
  let best = null
  const errors = process.env.ERRORS ? process.env.ERRORS.split(',').map(Number) : [0.002, 0.005, 0.01, 0.02, 0.04, 0.08, 0.15, 0.3]
  const lockBorder = process.env.LOCK_BORDER === '1'
  for (const error of errors) {
    const d = await io.readBinary(raw)
    await d.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: budget / before, error, lockBorder }))
    const t = tris(d)
    best = { d, t, error }
    if (t <= budget * 1.03) break
  }
  doc = best.d
  chosenError = best.error
  // still over budget: escalate (permissive+prune, then sloppy) — see hardSimplify()
  for (const mode of process.env.NO_FALLBACK === '1' ? [] : ['permissive', 'sloppy']) {
    if (tris(doc) <= budget * 1.03) break
    const d = await io.readBinary(raw)
    hardSimplify(d, budget, mode)
    const t = tris(d)
    console.error(`  ${mode}: ${t}`)
    if (t < tris(doc)) { doc = d; chosenError = mode }
  }
}
const after = tris(doc)
const modelCfg = JSON.parse(readFileSync('scripts/models.json', 'utf8')).models.find((m) => m.out === name)
if (modelCfg) applyMaterialFixes(doc, modelCfg)

await doc.transform(
  dedup(),
  prune(),
  // normal maps: higher quality (lossy artefacts read as bumps); everything else 82
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 94, slots: /^normalTexture$/ }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 82, slots: /^(?!normalTexture$).*/ }),
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
)
const outDir = process.env.OUT_DIR ?? 'public/models'
mkdirSync(outDir, { recursive: true })
await io.write(`${outDir}/${name}.glb`, doc)
console.log('COMPRESS ' + JSON.stringify({ name, before, after, budget, error: chosenError, rigged }))
