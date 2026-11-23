'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { requestHigh, store, useStore, type RafidKey } from '@/lib/store'
import { useLang } from '@/lib/i18n'
import { modelsOf } from '@/lib/lod'
import { LABEL_ANCHOR, RAFID_ORDER, RAFID_PARTS, RAFIDS } from '@/lib/views'
import { goToRafid } from '@/lib/nav'
import { RafidIcon } from '@/components/RafidIcon'
import { buildingObjects } from './Buildings'

/**
 * Map labels (video t032): a dark-glass pill floating above each building in 3D, with a thin stem
 * down to a dot on the roof. They move with the camera. Hover = gold highlight on the building +
 * a short description card; click = the building's flight.
 */
export default function Labels() {
  const phase = useStore((s) => s.phase)
  const busy = useStore((s) => s.busy)
  const hover = useStore((s) => s.hover)
  const introDone = useStore((s) => s.introDone)
  const view = useStore((s) => s.view)
  useLang()
  const on = phase === 'map' && !busy && introDone
  // drei <Html> also projects points behind the camera: drop the labels entirely inside interiors
  if (view === 'interior') return <Highlight />

  return (
    <>
      {RAFID_ORDER.map((id) => (
        <Html key={id} position={LABEL_ANCHOR[id]} zIndexRange={[15, 10]} style={{ pointerEvents: 'none' }}>
          <div className={`map-label${on ? ' is-on' : ''}${hover === id ? ' is-hover' : ''}`}>
            <div className="map-label__card glass" role="tooltip" id={`card-${id}`}>
              {RAFIDS[id].line}
            </div>
            <button
              type="button"
              className="map-label__pill glass is-pill"
              tabIndex={on ? 0 : -1}
              aria-describedby={`card-${id}`}
              onPointerEnter={() => {
                if (!on) return
                store.set({ hover: id })
                requestHigh(...modelsOf(id)) // likely next stop: start fetching its HIGH LOD
              }}
              onPointerLeave={() => store.get().hover === id && store.set({ hover: null })}
              onFocus={() => on && store.set({ hover: id })}
              onBlur={() => store.get().hover === id && store.set({ hover: null })}
              onClick={() => void goToRafid(id)}
            >
              <RafidIcon name={RAFIDS[id].icon} />
              <span>{RAFIDS[id].name}</span>
            </button>
            <span className="map-label__stem" aria-hidden="true" />
            <span className="map-label__dot" aria-hidden="true" />
          </div>
        </Html>
      ))}
      <Highlight />
    </>
  )
}

/** Eases each building's gold lift toward 1 while hovered (label or building), 0 otherwise. */
function Highlight() {
  const levels = useRef<Record<RafidKey, number>>({ reciters: 0, library: 0, learning: 0, community: 0 })
  const cache = useMemo(() => new Map<RafidKey, { value: number }[]>(), [])
  const stamp = useRef(0)
  useFrame(({ clock }, dt) => {
    const { hover, phase } = store.get()
    // re-collect every 2 s: HIGH LOD materials appear when they finish loading
    if (clock.elapsedTime - stamp.current > 2) {
      stamp.current = clock.elapsedTime
      cache.clear()
    }
    for (const id of RAFID_ORDER) {
      let uniforms = cache.get(id)
      if (!uniforms || uniforms.length === 0) {
        uniforms = []
        for (const part of RAFID_PARTS[id]) {
          buildingObjects[part]?.traverse((o) => {
            const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
            const u = m?.userData?.highlight as { value: number } | undefined
            if (u) uniforms!.push(u)
          })
        }
        cache.set(id, uniforms)
      }
      const want = hover === id && phase === 'map' ? 1 : 0
      levels.current[id] += (want - levels.current[id]) * Math.min(1, dt * 7)
      for (const u of uniforms) u.value = levels.current[id]
    }
  })
  return null
}
