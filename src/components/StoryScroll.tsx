'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import gsap from '@/lib/gsap'
import { store } from '@/lib/store'
import { MAP_AT, story } from '@/lib/story'
import { DEBUG } from '@/lib/debug'

gsap.registerPlugin(ScrollTrigger)

/** The page's root Lenis (scroll story). nav.ts uses it to jump (skip, home). */
export const storyScroll = {
  lenis: null as Lenis | null,
  /** jump to a progress 0..1 (immediate) */
  jumpTo(p: number) {
    const l = this.lenis
    if (!l) return
    l.scrollTo(p * l.limit, { immediate: true, force: true })
    story.p = p
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

    const lenis = new Lenis({ autoRaf: false, smoothWheel: true, lerp: 0.085, wheelMultiplier: 0.9 })
    storyScroll.lenis = lenis
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)

    const pinned = q.get('story')
    // debug entry points that start on the map: hold the story at its end until the scroll is there
    let holdEnd = q.get('phase') === 'map' || q.has('at') || q.has('into')
    if (holdEnd) story.p = 1
    const st = ScrollTrigger.create({
      trigger: '.story-track',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        if (holdEnd && self.progress < 0.99) return
        holdEnd = false
        if (!storyActive()) return // after the handoff the scroll never touches the camera
        if (pinned === null) story.p = self.progress
        gate()
      },
    })
    if (pinned !== null) story.p = Math.min(Math.max(Number(pinned) || 0, 0), 0.99)
    if (holdEnd) requestAnimationFrame(() => storyScroll.jumpTo(1))

    // page scroll only during the story itself (locked while loading, on the map, in buildings)
    const sync = () => {
      const { phase, ready, heroIntro } = store.get()
      if (!ready || phase !== 'hero' || heroIntro || pinned !== null) lenis.stop()
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
