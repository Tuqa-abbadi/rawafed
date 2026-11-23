'use client'

import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type * as THREE from 'three'
import { setNoReflect } from '@/lib/layers'
import { store, useStore } from '@/lib/store'
import Island from './Island'
import Buildings from './Buildings'
import Vegetation from './Vegetation'
import Boats from './Boats'
import Labels from './Labels'
import Stagger from '../Stagger'

function MapReady() {
  useEffect(() => {
    store.set({ mapReady: true })
  }, [])
  return null
}

/** Children render normally but are skipped by the water reflection. */
function NoReflect({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    if (ref.current) setNoReflect(ref.current)
  })
  return <group ref={ref}>{children}</group>
}

/**
 * The city map. Mounted only once the hero shows, so its ~10 MB of models stream in the
 * background and the initial download stays small (CLAUDE.md: < 15 MB).
 */
export default function MapWorld() {
  const phase = useStore((s) => s.phase)
  const mapWarm = useStore((s) => s.mapWarm)
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    if (phase === 'loading') return
    const t = setTimeout(() => setWaited(true), 30000) // safety net on very slow connections
    return () => clearTimeout(t)
  }, [phase])
  // mount once its textures are already on the GPU (Warmups); deep links / skip go straight in
  if (phase === 'loading' || (phase === 'hero' && !mapWarm && !waited)) return null
  // one part at a time (spreads the GPU uploads while the visitor is still in the hero)
  return (
    <Stagger gap={500}>
      <Island />
      <Buildings />
      <NoReflect>
        <Vegetation />
      </NoReflect>
      <Boats />
      <Labels />
      <MapReady />
    </Stagger>
  )
}
