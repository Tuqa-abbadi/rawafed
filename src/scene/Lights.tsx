'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sunDirection } from '@/lib/sky'
import { HERO, MAP_CAMERA } from '@/lib/layout'
import { store } from '@/lib/store'
import { story, walkerAt } from '@/lib/story'

/** Where the map key light comes from: front-left and high (t032/t038: warm lit facades). */
const KEY_DIR = new THREE.Vector3(-0.5, 0.62, 0.6).normalize()

/**
 * Golden-hour light.
 * Hero: low warm sun from the HDRI's sun direction (back-light) with soft shadows on the hero
 * area, plus a warm bounce from behind the camera so stone and walker read pale and warm (t004).
 * Map: the sun is behind the island as seen from the aerial camera, so a warm key light from the
 * front-left lights the facades and casts the island's shadows; the hero bounce fades down.
 */
export default function Lights({ shadows = true }: { shadows?: boolean }) {
  const scene = useThree((s) => s.scene)
  const sun = useRef<THREE.DirectionalLight>(null)
  const fill = useRef<THREE.DirectionalLight>(null)
  const key = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.copy(HERO.gateway).add(new THREE.Vector3(0, 0, -3))
    return o
  }, [])
  const mapTarget = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, 0, -80)
    return o
  }, [])
  const sunPos = useMemo(() => target.position.clone().add(sunDirection.clone().multiplyScalar(80)), [target])
  const keyPos = useMemo(() => mapTarget.position.clone().add(KEY_DIR.clone().multiplyScalar(300)), [mapTarget])

  useEffect(() => {
    scene.add(target, mapTarget)
    if (sun.current) sun.current.target = target
    if (fill.current) fill.current.target = target // without a target it aimed at the origin (behind the camera)
    if (key.current) {
      key.current.target = mapTarget
      key.current.shadow.autoUpdate = false
      key.current.shadow.needsUpdate = true // allocate its shadow map on the first frame
    }
    scene.environmentIntensity = 0.85 // t004: shadowed stone stays pale cream, never brown
    return () => {
      scene.remove(target, mapTarget)
    }
  }, [scene, target, mapTarget])

  // Shadows: castShadow never toggles (that recompiles every shader mid-flight). The island is
  // static, so the key light's shadow map is rendered only when the map has (re)loaded; the hero
  // sun stops re-rendering its map once we are on the map.
  const keyRendered = useRef(false)
  const inDim = useRef(0)
  useFrame((state) => {
    const h = THREE.MathUtils.clamp((state.camera.position.y - 6) / (MAP_CAMERA.position.y - 6), 0, 1)
    const m = THREE.MathUtils.smoothstep(h, 0.05, 0.6)
    // inside an interior the outdoor sun/fill would blow out the floors: dim them (interiors light themselves)
    const inside = store.get().view === 'interior'
    inDim.current = inside ? 1 : 0 // switched behind the fade: the first revealed frame is already right
    const outdoor = 1 - 0.85 * inDim.current
    if (fill.current) fill.current.intensity = THREE.MathUtils.lerp(3.6, 0.9, m) * outdoor
    if (sun.current) sun.current.intensity = 2.4 * outdoor
    scene.environmentIntensity = 0.85 * (1 - 0.4 * inDim.current)
    const fog = state.scene.fog as THREE.Fog | null
    if (fog) {
      // sunset haze: distant towers fade into a warm veil (more from the air)
      fog.near = THREE.MathUtils.lerp(260, 320, m)
      fog.far = THREE.MathUtils.lerp(2300, 1700, m)
    }
    const { phase, mapReady } = store.get()
    if (key.current) {
      key.current.intensity = 2.5 * m * outdoor
      if (mapReady && !keyRendered.current) {
        keyRendered.current = true
        // a couple of frames later, once all map instances have their matrices
        setTimeout(() => key.current && (key.current.shadow.needsUpdate = true), 300)
      }
    }
    if (sun.current) {
      // the sun's shadow map is live only in the hero (the walker moves); frozen on the map and inside
      sun.current.shadow.autoUpdate = phase === 'hero' || phase === 'loading'
      // the ±18 m sun-shadow box follows the walker along the colonnade (scroll story)
      if (phase === 'hero' || phase === 'loading') {
        target.position.copy(walkerAt(story.p).pos).add(new THREE.Vector3(0, 0, -3))
        sun.current.position.copy(target.position).addScaledVector(sunDirection, 80)
        target.updateMatrixWorld()
      }
    }
  })

  return (
    <>
      <directionalLight
        ref={sun}
        position={sunPos}
        color="#ffc48c" // deeper golden-hour sun (warm light on the arch stone)
        intensity={2.4}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={4}
      />
      {/* warm bounce from behind / above the hero camera (no shadows) */}
      <directionalLight ref={fill} position={[HERO.camStart.x + 3, 7, HERO.camStart.z + 14]} color="#ffd6ae" intensity={3.6} />
      {/* map key light: warm, front-left, shadows over the whole island */}
      <directionalLight
        ref={key}
        position={keyPos}
        color="#ffbd82"
        intensity={0}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-125}
        shadow-camera-right={125}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-camera-near={100}
        shadow-camera-far={520}
        shadow-bias={-0.0006}
        shadow-normalBias={0.12}
      />
    </>
  )
}
