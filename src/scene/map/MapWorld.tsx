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
  const heroLate = useStore((s) => s.heroLate)
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    if (phase === 'loading') return
    const t = setTimeout(() => setWaited(true), 4000)
    return () => clearTimeout(t)
  }, [phase])
  // deep links (?phase=map / ?at=) start on the map: no waiting
  if (phase === 'loading' || (phase === 'hero' && !heroLate && !waited)) return null
  return (
    <Suspense fallback={null}>
      <Island />
      <Buildings />
      <NoReflect>
        <Vegetation />
      </NoReflect>
      <Boats />
      <Labels />
      <MapReady />
    </Suspense>
  )
}
