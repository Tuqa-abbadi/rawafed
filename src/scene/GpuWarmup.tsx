'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Downloads the next scene's models in the background and uploads their textures to the GPU a few
 * at a time (a small time budget per frame) BEFORE the scene is mounted. Mounting is then cheap:
 * no big texture uploads in one frame, so no freezes while the visitor is in the hero / on the map.
 * The loaded models are cached, so the scene that mounts later reuses the same textures.
 */
export default function GpuWarmup({ urls, onDone, budgetMs = 5 }: { urls: string[]; onDone: () => void; budgetMs?: number }) {
  const gltfs = useGLTF(urls) // suspends until all are downloaded and parsed (off the main thread)
  const gl = useThree((s) => s.gl)
  const queue = useMemo(() => {
    const seen = new Set<THREE.Texture>()
    for (const g of gltfs) {
      g.scene.traverse((o) => {
        const mats = (o as THREE.Mesh).material
        for (const m of Array.isArray(mats) ? mats : mats ? [mats] : [])
          for (const v of Object.values(m as unknown as Record<string, unknown>)) if (v instanceof THREE.Texture) seen.add(v)
      })
    }
    return [...seen]
  }, [gltfs])
  const i = useRef(0)
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    const t0 = performance.now()
    // at least one texture per frame, more while the frame budget allows
    do {
      if (i.current >= queue.length) break
      gl.initTexture(queue[i.current++])
    } while (performance.now() - t0 < budgetMs)
    if (i.current >= queue.length) {
      done.current = true
      onDone()
    }
  })
  return null
}
