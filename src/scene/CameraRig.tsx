'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mapCameraFor } from '@/lib/layout'
import { store, useStore } from '@/lib/store'
import { camCtl } from '@/lib/camera'
import { HERO_LENS, story, storyCamera, type Lens } from '@/lib/story'

const mapLens = (aspect: number): Lens => {
  const v = mapCameraFor(aspect)
  return { shift: 1, tanV: v.tanHalfV, minTanH: v.minTanHalfH }
}

/**
 * One camera, two drivers:
 *  - landing (phase loading/hero): the scroll story — pose and lens are a pure function of the
 *    scroll progress (lib/story.ts), so it scrubs and reverses exactly; nothing moves at rest
 *  - map / building / interiors: the click-driven navigation controller (lib/camera.ts)
 * The story ends exactly on the map pose, so the handoff is seamless both ways.
 */
export default function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const phase = useStore((s) => s.phase)
  const pos = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const lens = useRef<Lens>({ ...HERO_LENS })
  const applied = useRef('')
  const sway = useRef(0) // gentle sway on the map only

  // projection: render the top part of a taller frustum (lens shift); re-applied when it changes
  const applyLens = useMemo(
    () => (w: number, h: number, l: Lens) => {
      const key = `${w}x${h}:${l.shift.toFixed(4)}:${l.tanV.toFixed(4)}:${l.minTanH.toFixed(4)}`
      if (key === applied.current) return
      applied.current = key
      const fullH = h * l.shift
      const fullAspect = w / fullH
      // widen on narrow (portrait) screens so the landmark / island stays in frame
      const tanHalfV = Math.max(l.tanV, l.minTanH / fullAspect)
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalfV))
      camera.aspect = fullAspect
      camera.near = 0.1
      camera.far = 4000
      camera.setViewOffset(w, fullH, 0, 0, w, h)
      camera.updateProjectionMatrix()
    },
    [camera],
  )
  useEffect(() => {
    applied.current = ''
  }, [size])

  // map: hold the aerial view unless navigation already holds a pose (returning from a building)
  useEffect(() => {
    if (phase !== 'map') return
    const view = mapCameraFor(size.width / size.height)
    const ml = mapLens(size.width / size.height)
    if (!camCtl.flight && !store.get().rafid) camCtl.jump({ pos: view.position, look: view.target }, ml.tanV)
    Object.assign(lens.current, ml)
  }, [phase, size])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const ph = store.get().phase
    const aspect = state.size.width / state.size.height
    if (ph === 'loading' || ph === 'hero') {
      const c = storyCamera(story.p, aspect)
      pos.current.copy(c.pos)
      look.current.copy(c.look)
      Object.assign(lens.current, c.lens)
    } else {
      // map / building / hall: navigation controller (spline flights and holds)
      const f = camCtl.flight
      if (f) {
        // constant-speed path (arc length): the speed comes only from the flight's ease, never from
        // uneven spline segments (no sudden speed changes); the look follows the same segment param
        const u = f.len > 0.05 ? f.pos.getUtoTmapping(THREE.MathUtils.clamp(f.t, 0, 1), undefined as unknown as number) : f.t
        pos.current.copy(f.pos.getPoint(u))
        look.current.copy(f.look.getPoint(u))
      } else if (camCtl.hold) {
        pos.current.copy(camCtl.hold.pos)
        look.current.copy(camCtl.hold.look)
      }
      lens.current.tanV = camCtl.tanV
    }
    camCtl.current.pos.copy(pos.current)
    camCtl.current.look.copy(look.current)
    applyLens(state.size.width, state.size.height, lens.current)

    // slow sway on the map so the aerial view feels alive; eases in/out (no jumps at the handoff)
    const want = ph === 'map' && !camCtl.flight ? 1 : 0
    sway.current += (want - sway.current) * Math.min(1, dt * 1.2)
    camera.position.copy(pos.current).add(new THREE.Vector3(Math.sin(t * 0.21) * 1.6 * sway.current, Math.sin(t * 0.33) * 0.8 * sway.current, 0))
    camera.lookAt(look.current)
  })

  return null
}
