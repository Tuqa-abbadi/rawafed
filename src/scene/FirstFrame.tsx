'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { store, useStore } from '@/lib/store'

/**
 * The loading page (page.tsx: warm sky, gold logo, progress line) stays on top until the hero is
 * REALLY on screen: shaders compiled (compileAsync) and the canvas verified to contain drawn frames
 * (one pixel read right after each render) for a short while. Only then `sceneShown` lets the
 * loading page fade — so the first thing the visitor sees of the 3D is the finished, still hero.
 */
export default function FirstFrame() {
  const phase = useStore((s) => s.phase)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const compiled = useRef(false)
  const drawn = useRef(0)
  const since = useRef(0)
  const probe = useMemo(() => {
    if (typeof document === 'undefined') return null
    const c = document.createElement('canvas')
    c.width = c.height = 1
    return c.getContext('2d', { willReadFrequently: true })
  }, [])

  useEffect(() => {
    if (phase === 'loading' || compiled.current) return
    let alive = true
    gl.compileAsync(scene, camera)
      .catch(() => {})
      .then(() => {
        if (!alive) return
        compiled.current = true
        // safety net: never stay on the loading page if the pixel check cannot pass on some GPU
        setTimeout(() => store.get().sceneShown || store.set({ sceneShown: true }), 8000)
      })
    return () => {
      alive = false
    }
  }, [phase, gl, scene, camera])

  // priority 2: runs right after the effect composer has rendered this frame (same task, so the
  // drawing buffer still holds the frame and can be sampled)
  useFrame(() => {
    if (store.get().sceneShown || !compiled.current || !probe) return
    const c = gl.domElement
    probe.clearRect(0, 0, 1, 1)
    probe.drawImage(c, c.width / 2, c.height * 0.7, 1, 1, 0, 0, 1, 1)
    const a = probe.getImageData(0, 0, 1, 1).data[3]
    if (a > 200) drawn.current++ // an opaque pixel = the scene was actually drawn
    // (a frame with nothing drawn yet does not reset the count)
    if (drawn.current === 2) since.current = performance.now()
    if (drawn.current >= 2 && performance.now() - since.current > 300) store.set({ sceneShown: true })
  }, 2)
  return null
}
