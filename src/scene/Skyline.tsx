'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { SEA_Y, SKYLINE, skylinePoint } from '@/lib/layout'
import { firstMesh } from '@/lib/materials'

const FILLERS = ['tower_twist', 'tower_slim', 'tower_stepped', 'tower_twin', 'tower_residential'] as const
const SUPERTALL = '/models/tower_supertall.glb'
const FILLER_URLS = FILLERS.map((n) => `/models/${n}.glb`)
// the whole skyline (landmark + Meshy back row) is part of the first view

/** Meshy materials: warm reflective glass picking up the sunset */
function towerParts(scenes: THREE.Object3D[]) {
  return scenes.map((s) => {
    const p = firstMesh(s)
    const mat = p.material.clone()
    mat.color.set('#ecd8c0')
    mat.metalnessMap = null
    mat.metalness = 0.7
    mat.roughness = 0.2
    mat.envMapIntensity = 1.4
    return { ...p, material: mat }
  })
}

/** Back row (hazy, far): loads after the first view. */
function SkylineFillers({ back }: { back: Inst[][] }) {
  const gltfs = useGLTF(FILLER_URLS)
  const parts = useMemo(() => towerParts(gltfs.map((g) => g.scene)), [gltfs])
  const refs = FILLERS.map(() => useRef<THREE.InstancedMesh>(null)) // fixed length: stable hook order
  FILLERS.forEach((_, i) => useInstances(refs[i], back[i], parts[i].matrix))
  return (
    <>
      {FILLERS.map((name, i) => (
        <instancedMesh key={name} ref={refs[i]} args={[parts[i].geometry, parts[i].material, Math.max(1, back[i].length)]} count={back[i].length} frustumCulled={false} />
      ))}
    </>
  )
}

function seeded(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

/**
 * The far shore across the bay (video t004): a low landmass just above the sea with a pale
 * promenade along its waterfront and a stone sea wall down into the water. Every tower stands on
 * it (skylinePoint returns its top height), so the full towers and their reflections show.
 * Ring sector around SKYLINE.origin covering the skyline's bearings.
 */
function FarShore() {
  const { y, inner, outer, promenade, bearingMin, bearingMax } = SKYLINE.shore
  const len = THREE.MathUtils.degToRad(bearingMax - bearingMin)
  // RingGeometry (XY, laid flat with rotation-x -90°): angle θ = 90° - bearing
  const ringStart = THREE.MathUtils.degToRad(90 - bearingMax)
  // CylinderGeometry: angle θ = 180° - bearing
  const cylStart = THREE.MathUtils.degToRad(180 - bearingMax)
  const mats = useMemo(
    () => ({
      land: new THREE.MeshStandardMaterial({ color: '#cbb592', roughness: 0.95, emissive: '#4a3a26', emissiveIntensity: 0.45 }),
      walk: new THREE.MeshStandardMaterial({ color: '#ecdfc8', roughness: 0.85, emissive: '#5a4a36', emissiveIntensity: 0.4 }),
      wall: new THREE.MeshStandardMaterial({ color: '#dcc8a8', roughness: 0.8, emissive: '#4a3a26', emissiveIntensity: 0.4, side: THREE.DoubleSide }),
    }),
    [],
  )
  const wallH = y - SEA_Y + 1.5
  return (
    <group position={[SKYLINE.origin.x, 0, SKYLINE.origin.z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={y} material={mats.land} receiveShadow>
        <ringGeometry args={[inner + promenade, outer, 160, 1, ringStart, len]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={y + 0.02} material={mats.walk}>
        <ringGeometry args={[inner, inner + promenade, 160, 1, ringStart, len]} />
      </mesh>
      <mesh position-y={y - wallH / 2} material={mats.wall}>
        <cylinderGeometry args={[inner, inner, wallH, 160, 1, true, cylStart, len]} />
      </mesh>
    </group>
  )
}

/** Height profile across the bay (t004): low near the sun (left), tall cluster right of centre. */
function profile(bearing: number) {
  return 0.4 + 0.9 * THREE.MathUtils.smoothstep(bearing, -34, 8) - 0.25 * THREE.MathUtils.smoothstep(bearing, 35, 46)
}

/** Glass curtain-wall texture: vertical mullions + faint floor bands, pale blue-grey. */
function makeGlassTexture() {
  const w = 128, h = 512
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#c9d4dc'); grad.addColorStop(1, '#aebcc6')
  g.fillStyle = grad; g.fillRect(0, 0, w, h)
  g.fillStyle = 'rgba(255,255,255,0.10)'
  for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1)
  g.fillStyle = 'rgba(60,72,82,0.22)'
  for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

type Inst = { pos: THREE.Vector3; rotY: number; scale: THREE.Vector3 }

function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, list: Inst[], local?: THREE.Matrix4) {
  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion()
    list.forEach((p, j) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotY)
      m.compose(p.pos, q, p.scale)
      if (local) m.multiply(local)
      im.setMatrixAt(j, m)
    })
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [ref, list, local])
}

/**
 * Skyline across the bay (video t004):
 *  - front row: clean procedural glass towers (boxes, cylinders, tapered) — the video's skyline is
 *    smooth glass; the heavily decimated Meshy fillers read as crumpled up close
 *  - back row: Meshy fillers, further away and hazier (fog)
 *  - the Meshy supertall as the landmark, right of centre
 */
export default function Skyline() {
  const superGltf = useGLTF(SUPERTALL)
  const parts = useMemo(
    () =>
      towerParts([superGltf.scene]).map((p) => {
        // landmark: the Meshy texture is bronze; the video's needle is silver-blue glass reflecting the sky
        const mat = p.material.clone()
        mat.map = null
        mat.color.set('#cdd7e2')
        mat.metalness = 0.5
        mat.roughness = 0.38 // satin: a mirror finish exaggerates the facets of the decimated mesh
        mat.envMapIntensity = 1.2
        return { ...p, material: mat }
      }),
    [superGltf],
  )

  const glass = useMemo(() => {
    const map = makeGlassTexture()
    // reflective glass picking up the warm sunset sky (HDRI), not grey plastic
    return new THREE.MeshStandardMaterial({ map, color: '#f0dcc4', metalness: 0.82, roughness: 0.14, envMapIntensity: 1.55 })
  }, [])
  const geoms = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1).translate(0, 0.5, 0)
    const taper = new THREE.CylinderGeometry(0.28, 0.5, 1, 20, 1).translate(0, 0.5, 0)
    // sail: curved, slanted crown (t006 tall curved towers right of the walker)
    const sailShape = new THREE.Shape()
    sailShape.moveTo(-0.5, 0)
    sailShape.lineTo(0.5, 0)
    sailShape.lineTo(0.5, 1)
    sailShape.quadraticCurveTo(0.05, 0.93, -0.5, 0.62)
    sailShape.closePath()
    const sail = new THREE.ExtrudeGeometry(sailShape, { depth: 0.7, bevelEnabled: false, curveSegments: 12 }).translate(0, 0, -0.35)
    // spire: cylinder with a pointed crown (t004 towers right of the supertall)
    const spire = new THREE.LatheGeometry(
      [new THREE.Vector2(0, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0.5, 0.8), new THREE.Vector2(0.36, 0.88), new THREE.Vector2(0.05, 1), new THREE.Vector2(0, 1)],
      20,
    )
    for (const g of [box, cyl, taper, sail, spire]) {
      // repeat the window grid along height (uv.y) — fine floors on tall towers
      const uv = g.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 14)
    }
    return [box, cyl, taper, sail, spire]
  }, [])

  const { front, back } = useMemo(() => {
    const rand = seeded(SKYLINE.seed)
    const front: Inst[][] = [[], [], [], [], []]
    const back: Inst[][] = FILLERS.map(() => [])
    for (let i = 0; i < SKYLINE.count; i++) {
      const t = i / (SKYLINE.count - 1)
      const bearing = THREE.MathUtils.lerp(SKYLINE.bearingMin, SKYLINE.bearingMax, t) + (rand() - 0.5) * 2.5
      if (Math.abs(bearing - SKYLINE.supertall.bearing) < 2.4) continue
      const p = profile(bearing)
      // front row: procedural glass
      // plain boxes/cylinders toward the sun (left), sails and spires in the tall cluster (right)
      const fancy = THREE.MathUtils.smoothstep(bearing, -10, 15)
      const kind = rand() < fancy * 0.6 ? 3 + Math.floor(rand() * 2) : Math.floor(rand() * 3)
      // slimmer and lower than before (t004: many thin towers, tops at 45–60% of the frame);
      // extra low near the sun so it stays visible just above the rooftops
      const nearSun = 1 - 0.55 * Math.exp(-((bearing + 21) ** 2) / 60)
      // wide height variety: many mid-rise, some very tall (further away, so taller overall)
      const height = (60 + Math.pow(rand(), 1.7) * 230) * p * nearSun
      const width = 14 + rand() * 18
      front[kind].push({
        pos: skylinePoint(bearing, THREE.MathUtils.lerp(SKYLINE.distMin, 1050, rand())),
        rotY: rand() * Math.PI,
        scale: new THREE.Vector3(width, height, width * (0.7 + rand() * 0.5)),
      })
      // back row: Meshy filler every other slot
      if (i % 2 === 0) {
        const type = Math.floor(rand() * FILLERS.length)
        back[type].push({
          pos: skylinePoint(bearing + (rand() - 0.5) * 2, THREE.MathUtils.lerp(1080, SKYLINE.distMax + 300, rand())),
          rotY: rand() * Math.PI * 2,
          scale: new THREE.Vector3().setScalar(0.85 * p * (0.6 + rand() * 0.9)),
        })
      }
    }
    return { front, back }
  }, [])

  const frontRefs = [0, 1, 2, 3, 4].map(() => useRef<THREE.InstancedMesh>(null)) // fixed length
  frontRefs.forEach((r, i) => useInstances(r, front[i]))

  // low white domes on the waterfront right of the supertall (t004/t006)
  const domes = useMemo(() => {
    const rand = seeded(23)
    const list: Inst[] = []
    for (const b of [9, 24, 29, 37, 41]) {
      const r = 8 + rand() * 9
      list.push({ pos: skylinePoint(b + (rand() - 0.5) * 2, SKYLINE.distMin - 10 + rand() * 30), rotY: 0, scale: new THREE.Vector3(r, r * 0.55, r) })
    }
    return list
  }, [])
  const domeRef = useRef<THREE.InstancedMesh>(null)
  useInstances(domeRef, domes)
  const domeGeom = useMemo(() => new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), [])

  const superPos = skylinePoint(SKYLINE.supertall.bearing, SKYLINE.supertall.distance)

  return (
    <group>
      <FarShore />
      {/* landmark: slimmer than the Meshy proportions (t004 tower is a needle) */}
      <group position={superPos} scale={[0.72 * SKYLINE.supertall.scale, SKYLINE.supertall.scale, 0.72 * SKYLINE.supertall.scale]}>
        <mesh geometry={parts[0].geometry} material={parts[0].material} matrixAutoUpdate={false} matrix={parts[0].matrix} />
      </group>
      {geoms.map((g, i) => (
        <instancedMesh key={`f${i}`} ref={frontRefs[i]} args={[g, glass, Math.max(1, front[i].length)]} count={front[i].length} frustumCulled={false} />
      ))}
      {/* part of the first view: towers never pop in after the page shows */}
      <SkylineFillers back={back} />
      <instancedMesh ref={domeRef} args={[domeGeom, undefined, domes.length]} frustumCulled={false}>
        <meshStandardMaterial color="#d9d3cb" roughness={0.6} metalness={0.1} />
      </instancedMesh>
    </group>
  )
}
