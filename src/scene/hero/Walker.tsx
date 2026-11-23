'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { store } from '@/lib/store'
import { STRIDE, story, walkerAt } from '@/lib/story'

const URL = '/models/walker.glb'
useGLTF.preload(URL)

/** Clip phase (0..1) at distance 0 (where the first step starts from the standing pose). */
const STAND_PHASE = 0.26

/**
 * Neutral standing pose (feet together, arms down): the rig has no idle clip, so it is built from
 * the bind pose (legs straight) with both upper arms rotated down along the body.
 */
function idleArmPose(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true)
  const out: { bone: THREE.Object3D; q: THREE.Quaternion }[] = []
  for (const side of ['Left', 'Right']) {
    const arm = scene.getObjectByName(`mixamorig${side}Arm`) ?? scene.getObjectByName(`mixamorig:${side}Arm`)
    const fore = scene.getObjectByName(`mixamorig${side}ForeArm`) ?? scene.getObjectByName(`mixamorig:${side}ForeArm`)
    if (!arm || !fore || !arm.parent) continue
    const pa = arm.getWorldPosition(new THREE.Vector3()), pf = fore.getWorldPosition(new THREE.Vector3())
    const dir = pf.sub(pa).normalize()
    const outward = new THREE.Vector3(dir.x, 0, dir.z).normalize()
    const target = new THREE.Vector3(0, -1, 0).addScaledVector(outward, 0.13).normalize()
    const swing = new THREE.Quaternion().setFromUnitVectors(dir, target)
    const world = swing.multiply(arm.getWorldQuaternion(new THREE.Quaternion()))
    const parentWorld = arm.parent.getWorldQuaternion(new THREE.Quaternion())
    out.push({ bone: arm, q: parentWorld.invert().multiply(world) })
  }
  return out
}

/**
 * The man in the white thobe, driven by the scroll story (lib/story.ts): he stands still inside
 * the gateway facing the sea (neutral pose), then walks as the user scrolls — the walk clip blends
 * in only while the scroll moves and advances with the distance he covers.
 */
export default function Walker() {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(URL)
  const { actions } = useAnimations(animations, group)
  const mats = useRef<THREE.MeshStandardMaterial[]>([])
  const idle = useRef<ReturnType<typeof idleArmPose>>([])
  const walkW = useRef(0) // walk-clip weight: 1 while the scroll moves him, 0 = standing
  const lastP = useRef(story.p)

  useLayoutEffect(() => {
    idle.current = idleArmPose(scene) // measured in the bind pose, before any clip plays
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = true
      m.receiveShadow = true
      m.frustumCulled = false // skinned mesh bounds don't follow the animation
      const mat = (m.material as THREE.MeshStandardMaterial).clone()
      mat.transparent = true
      mat.color.set('#fff6ea') // warm white thobe
      m.material = mat
      mats.current.push(mat)
    })
  }, [scene])

  useEffect(() => {
    const walk = actions['Walking']
    if (!walk) return
    walk.reset().play()
    walk.paused = true // time is set from the scroll every frame
    return () => {
      walk.stop()
    }
  }, [actions])

  useFrame((_, dt) => {
    const g = group.current
    const walk = actions['Walking']
    if (!g) return
    // walk only while the scroll moves him: weight follows the scroll speed, eased in/out
    const speed = Math.abs(story.p - lastP.current) / Math.max(dt, 1e-3)
    lastP.current = story.p
    const moving = speed > 0.002 && walkerAt(story.p).u > 0 && walkerAt(story.p).u < 1
    walkW.current += ((moving ? 1 : 0) - walkW.current) * Math.min(1, dt * 5)
    const phase = store.get().phase
    const w = walkerAt(story.p)
    g.position.copy(w.pos)
    g.rotation.y = Math.atan2(w.dir.x, w.dir.z) // model faces +Z
    if (walk) {
      const d = walk.getClip().duration
      walk.time = ((((w.dist / STRIDE + STAND_PHASE) % 1) + 1) % 1) * d
      walk.setEffectiveWeight(walkW.current) // the rest of the blend is the bind pose (standing)
    }
    // arms down when standing (applied after the mixer; absolute, so nothing accumulates)
    for (const a of idle.current) a.bone.quaternion.slerp(a.q, 1 - walkW.current)
    const opacity = phase === 'hero' || phase === 'loading' ? w.opacity : 0
    for (const m of mats.current) m.opacity = opacity
    g.visible = opacity > 0.01
  })

  return <primitive ref={group} object={scene} />
}
