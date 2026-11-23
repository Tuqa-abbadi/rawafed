import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
for (const n of process.argv.slice(2)) {
  const doc = await io.read(`public/models/${n}.glb`)
  for (const m of doc.getRoot().listMaterials())
    console.log(n, '|', m.getName(), '| metal', m.getMetallicFactor(), 'rough', m.getRoughnessFactor(), '| baseTex', !!m.getBaseColorTexture(), 'mrTex', !!m.getMetallicRoughnessTexture(), 'normal', !!m.getNormalTexture(), '| color', m.getBaseColorFactor().map(v=>v.toFixed(2)).join(','))
}
