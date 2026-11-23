'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'] as const

/**
 * Max anisotropic filtering on every texture in the scene (sharp stone and lattice at grazing
 * angles). Models stream in over time (map, HIGH LODs, interiors), so the scene is re-scanned
 * about once a second; textures already done are skipped.
 */
export default function TextureQuality() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const max = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl])
  const done = useMemo(() => new WeakSet<THREE.Texture>(), [])
  const last = useRef(-1)
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 1) return
    last.current = clock.elapsedTime
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.material) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        for (const k of SLOTS) {
          const t = (m as unknown as Record<string, THREE.Texture | null | undefined>)[k]
          if (!t || done.has(t)) continue
          done.add(t)
          if (t.anisotropy !== max) {
            t.anisotropy = max
            t.needsUpdate = true
          }
        }
      }
    })
  })
  return null
}
