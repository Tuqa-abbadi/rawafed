// Apply scripts/materials.mjs fixes to already-built public/models/*.glb in place (no rebuild).
// Usage: node scripts/patch_materials.mjs [name ...]
import { readFileSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { applyMaterialFixes } from './materials.mjs'

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
})
const cfg = JSON.parse(readFileSync('scripts/models.json', 'utf8')).models
const only = process.argv.slice(2)
for (const m of cfg.filter((m) => !only.length || only.includes(m.out))) {
  const file = `public/models/${m.out}.glb`
  const doc = await io.read(file)
  const metal = applyMaterialFixes(doc, m)
  await io.write(file, doc)
  console.log(`${m.out}: metallicFactor=${metal}`)
}
