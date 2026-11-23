// Lists triangles, materials and their texture maps (slot, size, mime) for GLB files.
// Usage: node scripts/inspect_maps.mjs <file.glb> [...]
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f)
  let tris = 0
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3
  console.log(`\n${f}  tris=${Math.round(tris)}  meshes=${doc.getRoot().listMeshes().length}`)
  for (const mat of doc.getRoot().listMaterials()) {
    const slots = { base: mat.getBaseColorTexture(), normal: mat.getNormalTexture(), mr: mat.getMetallicRoughnessTexture(), occ: mat.getOcclusionTexture(), emis: mat.getEmissiveTexture() }
    const parts = []
    for (const [k, t] of Object.entries(slots)) {
      if (!t) continue
      const meta = await sharp(Buffer.from(t.getImage())).metadata().catch(() => ({}))
      parts.push(`${k}:${meta.width}x${meta.height} ${t.getMimeType().split('/')[1]}`)
    }
    console.log(`  ${mat.getName() || '(mat)'}  metal=${mat.getMetallicFactor()} rough=${mat.getRoughnessFactor()} normalScale=${mat.getNormalScale?.()}  ${parts.join(' | ') || 'NO TEXTURES'}`)
  }
}
