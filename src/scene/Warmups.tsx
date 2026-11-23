'use client'

import { Suspense } from 'react'
import { store, useStore } from '@/lib/store'
import { BUILDINGS } from '@/lib/layout'
import { FILLERS } from './map/zones'
import GpuWarmup from './GpuWarmup'

const u = (n: string) => `/models/${n}.glb`
/** everything the map mounts */
const MAP_URLS = [...new Set([...Object.values(BUILDINGS).map((b) => b.model), ...Object.keys(FILLERS), 'fountain', 'palm', 'olive_tree', 'lantern', 'dhow', 'yacht'])].map(u)
/** everything the four rooms mount */
const ROOM_URLS = ['bookshelf', 'reading_desk', 'lantern_hi', 'class_desk', 'majlis', 'arcade_bay', 'hall_arch_wall', 'reciter_old', 'reciter_young'].map(u)

/**
 * Background preparation of the next scenes, in order: once the hero's own late parts are in, the
 * map's models download and their textures go to the GPU gradually; then the rooms'. MapWorld and
 * Interiors mount afterwards, so the hero and the map never freeze while they load.
 */
export default function Warmups() {
  // right after the hero's own assets: the city loads during the intro and the walk
  const start = useStore((s) => s.phase !== 'loading')
  const mapWarm = useStore((s) => s.mapWarm)
  if (!start) return null
  return (
    <>
      <Suspense fallback={null}>
        <GpuWarmup urls={MAP_URLS} onDone={() => store.set({ mapWarm: true })} />
      </Suspense>
      {mapWarm && (
        <Suspense fallback={null}>
          <GpuWarmup urls={ROOM_URLS} onDone={() => store.set({ roomsWarm: true })} />
        </Suspense>
      )}
    </>
  )
}
