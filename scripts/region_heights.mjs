// Height histogram of a model's vertices inside an x/z box (model space, metres).
// Usage: node scripts/region_heights.mjs <model> x0 x1 z0 z1
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
await MeshoptDecoder.ready
const [name, ...b] = process.argv.slice(2)
const [x0, x1, z0, z1] = b.map(Number)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(`public/models/${name}.glb`)
const hist = new Map()
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue
  const m = node.getWorldMatrix()
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'); const v = [0, 0, 0]
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v)
      const x = m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12], y = m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13], z = m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]
      if (x < x0 || x > x1 || z < z0 || z > z1) continue
      const k = Math.round(y * 10) / 10
      hist.set(k, (hist.get(k) ?? 0) + 1)
    }
  }
}
console.log([...hist.entries()].sort((a, b) => a[0] - b[0]).filter(([, c]) => c > 3).map(([y, c]) => `${y}:${c}`).join('  '))
