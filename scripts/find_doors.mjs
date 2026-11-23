// Finds each building's main entrance in its GLB: rays at many (lateral offset, height) along the
// front axis; the opening is where rays reach deepest into the facade. Prints door centre (world),
// floor height there, and the opening's width/height. Usage: node scripts/find_doors.mjs
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import * as THREE from 'three'

await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

const B = {
  reciters: { model: 'reciters', pos: [0, 0, -100], rotY: 0, scale: 1, front: 1 },
  learning: { model: 'learning', pos: [-62, 0, -92], rotY: Math.PI + 0.35, scale: 1.15, front: -1 },
  community: { model: 'community', pos: [56, 0, -76], rotY: -0.35, scale: 1, front: 1 },
  library: { model: 'library', pos: [-28, 0, -40], rotY: 0.15, scale: 1, front: 1 },
}

async function meshOf(name) {
  const doc = await io.read(`public/models/${name}.glb`)
  const pos = [], idx = []
  let base = 0
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const m = new THREE.Matrix4().fromArray(node.getWorldMatrix())
    for (const prim of mesh.listPrimitives()) {
      const p = prim.getAttribute('POSITION')
      const v = new THREE.Vector3()
      for (let i = 0; i < p.getCount(); i++) {
        v.fromArray(p.getElement(i, [])).applyMatrix4(m)
        pos.push(v.x, v.y, v.z)
      }
      const ind = prim.getIndices()
      if (ind) for (let i = 0; i < ind.getCount(); i++) idx.push(base + ind.getScalar(i))
      else for (let i = 0; i < p.getCount(); i++) idx.push(base + i)
      base += p.getCount()
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeBoundingBox()
  return g
}

const ray = new THREE.Raycaster()
const ONLY = process.env.MODEL ? { [process.env.MODEL]: { model: process.env.MODEL, pos: [0, 0, 0], rotY: Number(process.env.ROT ?? 0), scale: 1, front: 1 } } : B
for (const [id, b] of Object.entries(ONLY)) {
  const g = await meshOf(b.model)
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
  mesh.position.fromArray(b.pos)
  mesh.rotation.y = b.rotY
  mesh.scale.setScalar(b.scale)
  mesh.updateMatrixWorld(true)
  const c = new THREE.Vector3().fromArray(b.pos)
  const f = new THREE.Vector3(Math.sin(b.rotY) * b.front, 0, Math.cos(b.rotY) * b.front)
  const right = new THREE.Vector3(f.z, 0, -f.x)
  const bb = g.boundingBox.clone().applyMatrix4(mesh.matrixWorld)
  const top = bb.max.y
  const START = 80
  const hit = (o, d, far = 200) => {
    ray.set(o, d)
    ray.far = far
    const h = ray.intersectObject(mesh, false)[0]
    return h ? h.distance : Infinity
  }
  // ASCII depth map: rows = height (top first), cols = lateral offset (right of the facade as seen from outside = +s)
  console.log(`
${id}  (value = how far in front of the centre the first hit is, metres; '.' = no hit)`)
  const W = Number(process.env.W ?? 16)
  for (let y = Number(process.env.TOP ?? 13); y >= 0.25; y -= Number(process.env.DY ?? 0.75)) {
    let row = y.toFixed(2).padStart(5) + ' '
    for (let s = -W; s <= W; s += Number(process.env.DS ?? 1)) {
      const o = c.clone().addScaledVector(f, START).addScaledVector(right, -s).setY(y)
      const d = hit(o, f.clone().negate())
      row += isFinite(d) ? String(Math.round(START - d)).padStart(3) : '  .'
    }
    console.log(row)
  }
  let hdr = '      '
  for (let s = -W; s <= W; s += Number(process.env.DS ?? 1)) hdr += String(s).padStart(3)
  console.log(hdr)
}
