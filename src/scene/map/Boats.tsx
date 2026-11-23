'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { HERO } from '@/lib/layout'
import { firstMesh } from '@/lib/materials'

// no module-level preload: map models stream in only after the hero is up (MapWorld)

type Lane = { a: [number, number]; b: [number, number]; speed: number; phase: number }

/**
 * Lanes around the island (t012: dhows crossing the bay). All stay outside the hero view cone
 * (camera at z≈-147 looking -Z, ±40°) so the hero frame keeps its clean sea like the video.
 * Lanes are long (≥250 m) so the wrap-around happens far away and rarely.
 */
const DHOWS: Lane[] = [
  { a: [-330, -176], b: [-62, -176], speed: 1.1, phase: 0.55 },
  { a: [340, -206], b: [82, -206], speed: 0.9, phase: 0.3 },
  { a: [-124, 60], b: [-124, -150], speed: 0.8, phase: 0.45 },
  { a: [128, -150], b: [128, 60], speed: 0.7, phase: 0.6 },
  { a: [-420, -242], b: [-115, -242], speed: 1.0, phase: 0.75 },
]
const YACHTS: Lane[] = [
  { a: [118, -188], b: [380, -188], speed: 2.2, phase: 0.1 },
  { a: [135, -262], b: [420, -262], speed: 1.8, phase: 0.5 },
  { a: [-134, -228], b: [-380, -228], speed: 2.0, phase: 0.2 },
]

/**
 * Bow direction in model space, measured with scripts/bow_axis.mjs: both the dhow and the yacht
 * taper to a point toward -X (the wide transom / raised stern is at +X).
 */
const BOW_YAW = Math.PI // rotate the model so its -X bow points along +X before steering

function Fleet({ model, lanes, seed }: { model: string; lanes: Lane[]; seed: number }) {
  const { scene } = useGLTF(`/models/${model}.glb`)
  const part = useMemo(() => firstMesh(scene), [scene])
  const ref = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1) }), [])
  // per boat: last position (for the velocity) and the smoothed heading
  const state = useMemo(() => lanes.map(() => ({ x: NaN, z: NaN, yaw: NaN })), [lanes])

  useFrame(({ clock }, dt) => {
    const im = ref.current
    if (!im) return
    const t = clock.elapsedTime
    lanes.forEach((l, i) => {
      const dx = l.b[0] - l.a[0], dz = l.b[1] - l.a[1]
      const len = Math.hypot(dx, dz)
      const f = (((t * l.speed) / len + l.phase) % 1 + 1) % 1
      const k = seed + i * 1.7
      const x = l.a[0] + dx * f, z = l.a[1] + dz * f
      const st = state[i]
      // heading = direction of travel (velocity); the lane wrap (far away) snaps instead of spinning
      let vx = x - st.x, vz = z - st.z
      const jumped = !(Math.hypot(vx, vz) < 5)
      if (jumped) (vx = dx), (vz = dz)
      const want = -Math.atan2(vz, vx) + BOW_YAW
      if (jumped || Number.isNaN(st.yaw)) st.yaw = want
      else {
        let d = want - st.yaw
        d = Math.atan2(Math.sin(d), Math.cos(d)) // shortest way round
        st.yaw += d * Math.min(1, dt * 1.5) // smooth turning
      }
      st.x = x
      st.z = z
      tmp.p.set(x, HERO.waterY - 0.35 + Math.sin(t * 0.9 + k) * 0.12, z)
      // gentle pitch (about the beam) and roll (about the keel)
      tmp.e.set(Math.sin(t * 0.7 + k) * 0.03, st.yaw, Math.sin(t * 0.55 + k * 2) * 0.045, 'YXZ')
      tmp.q.setFromEuler(tmp.e)
      tmp.m.compose(tmp.p, tmp.q, tmp.s).multiply(part.matrix)
      im.setMatrixAt(i, tmp.m)
    })
    im.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[part.geometry, part.material, lanes.length]} frustumCulled={false} castShadow />
}

export default function Boats() {
  return (
    <group>
      <Fleet model="dhow" lanes={DHOWS} seed={1} />
      <Fleet model="yacht" lanes={YACHTS} seed={5} />
    </group>
  )
}
