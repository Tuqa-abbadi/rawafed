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
  const pills = useRef<Partial<Record<RafidKey, HTMLButtonElement | null>>>({})
  const stems = useRef<Partial<Record<RafidKey, HTMLSpanElement | null>>>({})
  const cards = useRef<Partial<Record<RafidKey, HTMLDivElement | null>>>({})
  useLabelLayout(pills, stems, cards)
  // drei <Html> also projects points behind the camera: drop the labels entirely inside interiors
  if (view === 'interior') return <Highlight />

  return (
    <>
      {RAFID_ORDER.map((id) => (
        <Html key={id} position={LABEL_ANCHOR[id]} zIndexRange={[15, 10]} style={{ pointerEvents: 'none' }}>
          <div className={`map-label${on ? ' is-on' : ''}${hover === id ? ' is-hover' : ''}`}>
            <div className="map-label__card glass" role="tooltip" id={`card-${id}`} ref={(el) => void (cards.current[id] = el)}>
              {RAFIDS[id].line}
            </div>
            <button
              type="button"
              className="map-label__pill glass is-pill"
              ref={(el) => void (pills.current[id] = el)}
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
            <span className="map-label__stem" aria-hidden="true" ref={(el) => void (stems.current[id] = el)} />
            <span className="map-label__dot" aria-hidden="true" />
          </div>
        </Html>
      ))}
      <Highlight />
    </>
  )
}

/**
 * Simple collision avoidance (all screen sizes, mostly needed on phones): every frame the labels
 * are placed from the lowest on screen upward; a label whose pill would overlap one already placed
 * is lifted above it by lengthening its stem (the dot stays on its building). Eased, so no jitter.
 */
function useLabelLayout(
  pills: React.RefObject<Partial<Record<RafidKey, HTMLButtonElement | null>>>,
  stems: React.RefObject<Partial<Record<RafidKey, HTMLSpanElement | null>>>,
  cards: React.RefObject<Partial<Record<RafidKey, HTMLDivElement | null>>>,
) {
  const lift = useRef<Record<RafidKey, number>>({ reciters: 0, library: 0, learning: 0, community: 0 })
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }, dt) => {
    const base = size.width <= 640 ? 18 : 42 // stem length (px)
    const items = RAFID_ORDER.map((id) => {
      v.copy(LABEL_ANCHOR[id]).project(camera)
      const pill = pills.current[id]
      return { id, x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height, w: pill?.offsetWidth ?? 0, h: pill?.offsetHeight ?? 0 }
    }).sort((a, b) => b.y - a.y)
    const placed: { x: number; w: number; top: number; bottom: number }[] = []
    // nothing above the top nav's bottom edge + 16 px (canvas-relative)
    const nav = document.querySelector('.top-nav')?.getBoundingClientRect()
    const canvasTop = (document.querySelector('canvas')?.getBoundingClientRect().top ?? 0)
    const minTop = nav && nav.height ? nav.bottom - canvasTop + 16 : 0
    const GAP = 6
    for (const it of items) {
      let extra = 0
      for (let pass = 0; pass < 4; pass++) {
        const bottom = it.y - 6 - base - extra // pill bottom (dot ~6 px)
        const top = bottom - it.h
        const hit = placed.find((p) => Math.abs(p.x - it.x) < (p.w + it.w) / 2 + GAP && top < p.bottom + GAP && bottom > p.top - GAP)
        if (!hit) break
        extra += bottom - (hit.top - GAP)
      }
      // clamp under the nav: shorten the stem first (min 6 px), then shift the whole pill down
      let shift = 0
      const top0 = it.y - 6 - base - extra - it.h
      if (top0 < minTop) {
        const room = base + extra - 6
        const cut = Math.min(room, minTop - top0)
        extra -= cut
        shift = minTop - top0 - cut
      }
      const bottom = it.y - 6 - base - extra + shift
      placed.push({ x: it.x, w: it.w, top: bottom - it.h, bottom })
      const pill = pills.current[it.id]
      if (pill) pill.style.translate = shift > 0.5 ? `0 ${shift.toFixed(1)}px` : ''
      // description card: just below the pill, kept inside the screen (8 px margins)
      const card = cards.current[it.id]
      if (card) {
        const cw = card.offsetWidth, ch = card.offsetHeight
        card.style.setProperty('--card-w', `${cw}px`)
        card.style.setProperty('--card-top', `${(it.h + shift + 8).toFixed(1)}px`)
        const left = it.x - cw / 2
        let dx = 0
        if (left < 8) dx = 8 - left
        else if (left + cw > size.width - 8) dx = size.width - 8 - (left + cw)
        // pill bottom on screen -> card bottom; if it would leave the screen, open above-left/right instead
        const cardTop = bottom + 8
        const dy = cardTop + ch > size.height - 8 ? size.height - 8 - (cardTop + ch) : 0
        card.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`
      }
      const cur = lift.current[it.id]
      lift.current[it.id] = cur + (extra - cur) * Math.min(1, dt * 10)
      const stem = stems.current[it.id]
      if (stem) stem.style.height = `${(base + lift.current[it.id]).toFixed(1)}px`
    }
  })
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
