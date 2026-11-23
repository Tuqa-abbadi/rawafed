'use client'

import { useEffect } from 'react'
import { requestHigh, store, useStore, type RafidKey } from '@/lib/store'
import { modelsOf } from '@/lib/lod'
import { camCtl } from '@/lib/camera'
import { INTERIOR_ORIGIN, INTERIOR_SHOT, RAFID_ORDER, entranceFor, pathInto } from '@/lib/views'
import { mapCameraFor } from '@/lib/layout'
import * as THREE from 'three'

/**
 * Screenshot/debug entry points (no effect without query params):
 *   ?at=<rafid>             jump to a building's entrance view (panel open)
 *   ?at=<rafid>&inside=1    jump into its interior
 *   ?phase=map&hover=<rafid> map with a hovered label
 */
export default function DebugGate() {
  const mapReady = useStore((s) => s.mapReady)
  const interiorsReady = useStore((s) => s.interiorsReady)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    // ?into=<rafid>&t=0..1 pins a frame of the flight INTO a building
    const into = q.get('into') as RafidKey | null
    if (into && RAFID_ORDER.includes(into) && mapReady) {
      const m = mapCameraFor(window.innerWidth / window.innerHeight)
      const p2 = pathInto({ pos: m.position.clone(), look: m.target.clone() }, into)
      const path = { pos: [...p2.descend.pos, ...p2.through.pos.slice(1)], look: [...p2.descend.look, ...p2.through.look.slice(1)] }
      const t = Number(q.get('t') ?? 0.8)
      const pc = new THREE.CatmullRomCurve3(path.pos, false, 'centripetal'), lc = new THREE.CatmullRomCurve3(path.look, false, 'centripetal')
      store.set({ phase: 'building', rafid: into, view: null })
      camCtl.jump({ pos: pc.getPoint(t), look: lc.getPoint(t) }, 0.4)
      return
    }
    const at = q.get('at') as RafidKey | null
    const hover = q.get('hover') as RafidKey | null
    if (hover && RAFID_ORDER.includes(hover) && mapReady) store.set({ introDone: true, hover })
    if (!at || !RAFID_ORDER.includes(at) || !mapReady) return
    requestHigh(...modelsOf(at))
    if (q.has('inside')) {
      if (!interiorsReady) return
      const o = INTERIOR_ORIGIN[at], shot = INTERIOR_SHOT[at]
      store.set({ phase: 'building', rafid: at, view: 'interior', arrived: true, introDone: true })
      camCtl.jump({ pos: shot.to.pos.clone().add(o), look: shot.to.look.clone().add(o) }, 0.46)
    } else {
      store.set({ phase: 'building', rafid: at, view: 'entrance', introDone: true })
      camCtl.jump(entranceFor(at, window.innerWidth / window.innerHeight), 0.36)
    }
  }, [mapReady, interiorsReady])
  return null
}
