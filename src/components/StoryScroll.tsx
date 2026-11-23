'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import gsap from '@/lib/gsap'
import { store } from '@/lib/store'
import { MAP_AT, RISE_START, story } from '@/lib/story'

const HOLD_AT = RISE_START - 0.002 // the walk's end, just before the camera turns to the city
import { DEBUG } from '@/lib/debug'

gsap.registerPlugin(ScrollTrigger)

/** The page's root Lenis (scroll story). nav.ts uses it to jump (skip, home). */
/** light scrub: the story follows the scroll position with a short ease (wheel, trackpad, touch alike) */
const scrub = { target: 0, tau: 0.16 }

export const storyScroll = {
  lenis: null as Lenis | null,
  /** jump to a progress 0..1 (immediate) */
  jumpTo(p: number) {
    const l = this.lenis
    if (!l) return
    l.scrollTo(p * l.limit, { immediate: true, force: true })
    story.p = p
    scrub.target = p
    ScrollTrigger.update()
  },
}

/**
 * One-way handoff: at the end of the story -> 'map' (once the map is in). From then on the scroll
 * story is OFF (page scroll locked, progress frozen): only the click navigation drives the camera.
 * The story comes back only through الرئيسية (goHome), which rewinds it to 0.
 */
function gate() {
  const s = store.get()
  if (s.busy || !s.ready) return
  if (s.phase === 'hero' && story.p >= MAP_AT && s.mapReady) store.set({ phase: 'map' })
}
const storyActive = () => {
  const ph = store.get().phase
  return ph === 'hero' || ph === 'loading'
}

/**
 * Scroll-driven landing (Lenis + GSAP ScrollTrigger): the page scrolls over the tall
 * `.story-track` (app/page.tsx) and its progress drives the whole story (lib/story.ts).
 * Scrolling is paused while loading and while visiting a building.
 * Debug: ?story=0.5 pins the progress (screenshots), ?phase=map / ?at= start at the end.
 */
export default function StoryScroll() {
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    const q = new URLSearchParams(DEBUG ? window.location.search : '')

    // smooth wheel (Lenis), native touch momentum; the scrub below evens out both
    const lenis = new Lenis({ autoRaf: false, smoothWheel: true, lerp: 0.09, wheelMultiplier: 0.85, touchMultiplier: 1.2 })
    storyScroll.lenis = lenis
    lenis.on('scroll', ScrollTrigger.update)
    let last = performance.now()
    const tick = (time: number) => {
      lenis.raf(time * 1000)
      // scrub: story.p eases toward the scroll position (refs only, no React state)
      const now = performance.now()
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      // the city must be fully there before the camera turns to it: hold at the end of the walk
      // (thin gold progress line) until the map is ready, then the rise continues
      const target = store.get().mapReady ? scrub.target : Math.min(scrub.target, HOLD_AT)
      const held = !store.get().mapReady && storyActive() && scrub.target > HOLD_AT && story.p > HOLD_AT - 0.02
      if (held !== store.get().held) store.set({ held })
      if (pinned === null && storyActive() && Math.abs(target - story.p) > 1e-5) {
        story.p += (target - story.p) * (1 - Math.exp(-dt / scrub.tau))
        if (Math.abs(target - story.p) < 2e-4) story.p = target
        gate()
      }
    }
    gsap.ticker.add(tick)

    const pinned = q.get('story')
    // debug entry points that start on the map: hold the story at its end until the scroll is there
    let holdEnd = q.get('phase') === 'map' || q.has('at') || q.has('into')
    if (holdEnd) story.p = scrub.target = 1
    const st = ScrollTrigger.create({
      trigger: '.story-track',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        if (holdEnd && self.progress < 0.99) return
        holdEnd = false
        if (!storyActive()) return // after the handoff the scroll never touches the camera
        if (pinned === null) scrub.target = self.progress
        gate()
      },
    })
    if (pinned !== null) story.p = Math.min(Math.max(Number(pinned) || 0, 0), 0.99)
    if (holdEnd) requestAnimationFrame(() => storyScroll.jumpTo(1))

    // page scroll only during the story itself (locked while loading, on the map, in buildings)
    const sync = () => {
      const { phase, ready } = store.get()
      if (!ready || phase !== 'hero' || pinned !== null) lenis.stop()
      else lenis.start()
      gate()
    }
    sync()
    const unsub = store.subscribe(sync)
    return () => {
      unsub()
      st.kill()
      gsap.ticker.remove(tick)
      lenis.destroy()
      storyScroll.lenis = null
    }
  }, [])
  return null
}
