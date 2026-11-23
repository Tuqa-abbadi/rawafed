// Which end of a boat model is the bow? Prints hull width (z) and deck height (y) in slices along X:
// the bow is the narrow, pointed end; the stern is wide/flat (dhows: raised stern castle).
// Usage: node scripts/bow_axis.mjs dhow yacht
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
for (const name of process.argv.slice(2)) {
  const doc = await io.read(`public/models/${name}.glb`)
  const pts = []
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue
    const m = node.getWorldMatrix()
    for (const prim of mesh.listPrimitives()) {
      const a = prim.getAttribute('POSITION')
      for (let i = 0; i < a.getCount(); i++) {
        const [x, y, z] = a.getElement(i, [])
        pts.push([m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]])
      }
    }
  }
  const xs = pts.map(p => p[0]), mn = Math.min(...xs), mx = Math.max(...xs)
  console.log(name, 'x', mn.toFixed(1), '..', mx.toFixed(1))
  for (let k = 0; k < 10; k++) {
    const a = mn + (mx - mn) * k / 10, b = mn + (mx - mn) * (k + 1) / 10
    const s = pts.filter(p => p[0] >= a && p[0] < b && p[1] < 3)
    if (!s.length) { console.log('  slice', k, 'empty'); continue }
    const zw = Math.max(...s.map(p => p[2])) - Math.min(...s.map(p => p[2]))
    const yh = Math.max(...pts.filter(p => p[0] >= a && p[0] < b).map(p => p[1]))
    console.log(`  x ${a.toFixed(1).padStart(6)}..${b.toFixed(1).padStart(6)}  hull width ${zw.toFixed(2)}  top ${yh.toFixed(2)}`)
  }
}
