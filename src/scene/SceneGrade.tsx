'use client'

import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { BloomEffect } from 'postprocessing'
import type { GoldenGradeEffect } from '@/effects/GoldenGrade'
import { store } from '@/lib/store'

/** hero (landing): deeper golden hour, warmer sky, slightly richer contrast */
const HERO = { exposure: 0.5, bloom: 0.3, contrast: 1.12, skyWarm: 1 }
const BASE = { exposure: 0.48, bloom: 0.3, contrast: 1.06, skyWarm: 0.6 }
/** القرّاء hall: softer, lower exposure and almost no bloom (no hot spots on the white thobe) */
// same grade as the map: no exposure / bloom / tone-mapping change when entering the hall
const HALL = BASE

/**
 * Per-scene grade: the reciters hall gets a lower exposure and very little bloom. The switch
 * happens behind the entry/exit fade (instant), so it never shows as a lighting change.
 */
export default function SceneGrade({ grade, bloom }: { grade: RefObject<GoldenGradeEffect | null>; bloom: RefObject<BloomEffect | null> }) {
  const last = useRef<GoldenGradeEffect | null>(null)
  useFrame(() => {
    const { rafid, view, phase } = store.get()
    const p = rafid === 'reciters' && view === 'interior' ? HALL : phase === 'hero' || phase === 'loading' ? HERO : BASE
    const g = grade.current?.uniforms
    if (g) {
      // instant on load and whenever the effect is rebuilt (nothing drifts after the page shows);
      // eased only across the hero -> map handoff, which is a continuous camera move anyway
      const fresh = grade.current !== last.current
      last.current = grade.current
      const ease = (k: string, v: number) => {
        const u = g.get(k)
        if (u) u.value = fresh || phase === 'loading' ? v : u.value + (v - u.value) * 0.06
      }
      const ex = g.get('exposure')
      if (ex) ex.value = p.exposure // instant: scene switches happen behind a fade
      ease('contrast', p.contrast)
      ease('skyWarm', p.skyWarm)
    }
    if (bloom.current) bloom.current.intensity = p.bloom
  })
  return null
}
