import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { getBounds } from '@gltf-transform/core'
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
for (const n of process.argv.slice(2)) {
  const doc = await io.read(`public/models/${n}.glb`)
  const b = getBounds(doc.getRoot().listScenes()[0])
  console.log(n.padEnd(18), 'min', b.min.map(v=>v.toFixed(1)).join(','), ' max', b.max.map(v=>v.toFixed(1)).join(','))
}
