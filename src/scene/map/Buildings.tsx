'use client'

import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { Detailed, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { BUILDINGS, COMMUNITY_PLAZA, POOL } from '@/lib/layout'
import { goldGlowMaterial } from '@/lib/materials'
import ModelInstances from './ModelInstances'
import { requestHigh, store, useStore, type RafidKey } from '@/lib/store'
import { HAS_HIGH, LOD_DISTANCE, highUrl, modelsOf } from '@/lib/lod'
import { goToRafid } from '@/lib/nav'
import type { ThreeEvent } from '@react-three/fiber'
import { FILLERS } from './zones'

export type BuildingKey = keyof typeof BUILDINGS
const url = (m: string) => `/models/${m}.glb`
// no module-level preload: map models stream in only after the hero is up (MapWorld)

const STONE = '#F3E7D5' // ivory stone (t032/t038: white-cream buildings, warm light)

/** Hero building roots by key — Stage 5 uses these for hover highlight and flights. */
export const buildingObjects: Partial<Record<BuildingKey, THREE.Object3D>> = {}

/** A building model with its own materials (each building glows independently on hover). */
function usePrepared(path: string, pickable: boolean) {
  const { scene } = useGLTF(path)
  return useMemo(() => {
    const o = scene.clone(true)
    o.traverse((c) => {
      const m = c as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = m.receiveShadow = true
      const mat = (m.material as THREE.MeshStandardMaterial).clone()
      mat.color.set(STONE)
      goldGlowMaterial(mat, 0.55)
      m.material = mat
      // HIGH is never picked: clicks only matter on the map, where LOW shows (and 300k-tri raycasts are slow)
      if (!pickable) m.raycast = () => {}
    })
    return o
  }, [scene, pickable])
}

/** HIGH + LOW swapped by camera distance (drei <Detailed>); mounted once HIGH has loaded. */
function LodPair({ model, low }: { model: string; low: THREE.Object3D }) {
  const high = usePrepared(highUrl(model), false)
  return (
    <Detailed distances={[0, LOD_DISTANCE[model] ?? 90]}>
      <primitive object={high} />
      <primitive object={low} />
    </Detailed>
  )
}

function HeroBuilding({ id }: { id: BuildingKey }) {
  const b = BUILDINGS[id]
  const low = usePrepared(url(b.model), true)
  const wantHigh = useStore((s) => !!s.hi[b.model]) && HAS_HIGH.has(b.model)
  const root = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    if (root.current) buildingObjects[id] = root.current
    return () => {
      delete buildingObjects[id]
    }
  }, [id])
  // the building itself is clickable on the map too (same as its label)
  const rafid = id as RafidKey
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (store.get().phase !== 'map' || store.get().busy) return
    store.set({ hover: rafid })
    requestHigh(...modelsOf(rafid)) // likely next stop: start fetching its HIGH LOD
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    if (store.get().hover === rafid) store.set({ hover: null })
    document.body.style.cursor = ''
  }
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (store.get().phase !== 'map') return
    document.body.style.cursor = ''
    void goToRafid(rafid)
  }
  return (
    <group ref={root} position={b.pos} rotation-y={b.rotY} scale={b.scale} onPointerOver={over} onPointerOut={out} onClick={click}>
      {wantHigh ? (
        <Suspense fallback={<primitive object={low} />}>
          <LodPair model={b.model} low={low} />
        </Suspense>
      ) : (
        <primitive object={low} />
      )}
    </group>
  )
}

const stone = (m: THREE.MeshStandardMaterial) => {
  m.color.set(STONE)
  goldGlowMaterial(m, 0.45)
}
// t038: white fabric canopies (the Meshy pergola is red wood + cloth)
const whiteCanopy = (m: THREE.MeshStandardMaterial) => {
  m.map = null
  m.color.set('#f6efe4')
  m.roughness = 0.8
}

export default function Buildings() {
  return (
    <group>
      {(Object.keys(BUILDINGS) as BuildingKey[]).map((id) => (
        <HeroBuilding key={id} id={id} />
      ))}
      {(Object.keys(FILLERS) as (keyof typeof FILLERS)[]).map((name) => (
        <ModelInstances key={name} url={url(name)} list={[...FILLERS[name]]} prepare={name === 'pergola' ? whiteCanopy : stone} />
      ))}
      <ModelInstances
        url={url('fountain')}
        list={[
          { pos: [COMMUNITY_PLAZA.x, 0, COMMUNITY_PLAZA.z], rotY: 0, scale: 1.6 },
          { pos: [POOL.x, 0, POOL.channel.z1 + 5], rotY: 0, scale: 1.2 }, // closes the axis at the promenade
        ]}
        prepare={stone}
      />
    </group>
  )
}
