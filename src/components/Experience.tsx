'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { AdaptiveEvents, PerformanceMonitor, useProgress } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { HalfFloatType } from 'three'
import HeroOverlay from './HeroOverlay'
import Sky from './Sky'
import { GoldenGrade, type GoldenGradeEffect } from '@/effects/GoldenGrade'
import type { BloomEffect } from 'postprocessing'
import SceneGrade from '@/scene/SceneGrade'
import Warmups from '@/scene/Warmups'
import FirstFrame from '@/scene/FirstFrame'
import Water from '@/scene/Water'
import Skyline from '@/scene/Skyline'
import SunGlitter from '@/scene/SunGlitter'
import Lights from '@/scene/Lights'
import CameraRig from '@/scene/CameraRig'
import TextureQuality from '@/scene/TextureQuality'
import HeroSet from '@/scene/hero/HeroSet'
import Walker from '@/scene/hero/Walker'
import MapWorld from '@/scene/map/MapWorld'
import MapOverlay from './MapOverlay'
import Interiors from '@/scene/interiors/Interiors'
import TopNav from './TopNav'
import SidePanel from './SidePanel'
import SceneFade from './SceneFade'
import DebugGate from './DebugGate'
import StoryScroll from './StoryScroll'
import HallUI from './HallUI'
import { store, useStore } from '@/lib/store'
import { DEBUG } from '@/lib/debug'

/** Haze matching the horizon colour of the sky JPG near the sun side (video skyline is hazy peach). */
const FOG = '#dcc1a1'

/** Thin gold progress line at the bottom (page.tsx #intro-progress) while the hero loads. */
function LoadLine() {
  const { progress } = useProgress()
  const phase = useStore((s) => s.phase)
  const held = useStore((s) => s.held)
  useEffect(() => {
    const el = document.getElementById('intro-progress')
    if (!el) return
    const bar = el.firstElementChild as HTMLElement | null
    if (bar) bar.style.transform = `scaleX(${Math.max(0.04, progress / 100)})`
    // the hero while loading, then only if the walk has to wait for the city
    el.classList.toggle('is-done', !(phase === 'loading' || held))
  }, [progress, phase, held])
  return null
}

/** Stop rendering while the tab is hidden (no GPU work in the background). */
function PauseWhenHidden() {
  const setFrameloop = useThree((s) => s.setFrameloop)
  useEffect(() => {
    const on = () => setFrameloop(document.hidden ? 'never' : 'always')
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [setFrameloop])
  return null
}

function ReadyGate() {
  const { active, progress, total } = useProgress()
  useEffect(() => {
    if (!active && total > 0 && progress >= 100 && store.get().phase === 'loading') {
      // debug/screenshots: ?phase=map / ?at= start on the map; ?story=0..1 pins the landing story
      const q = new URLSearchParams(DEBUG ? window.location.search : '')
      const phase = q.get('phase') === 'map' || q.has('at') || q.has('into') ? 'map' : 'hero'
      store.set({ phase, ready: true })
    }
  }, [active, progress, total])
  return null
}

export default function Experience() {
  const grade = useRef<GoldenGradeEffect>(null)
  const bloom = useRef<BloomEffect>(null)
  // lite mode on phones / small touch screens: DPR 1, no shadows, no bloom, no MSAA, smaller reflections
  const phoneLite = useMemo(() => typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820), [])
  // adaptive quality: PerformanceMonitor lowers the resolution when fps drops (and raises it back),
  // and switches to the lite effects chain if the machine keeps struggling
  const [dpr, setDpr] = useState(phoneLite ? 1 : 1.25)
  // effects never switch while the page is shown (bloom on/off would visibly change the look):
  // only the resolution adapts; phones use the lite chain from the start
  const lite = phoneLite
  return (
    <>
      <Canvas
        shadows={phoneLite ? false : 'percentage'}
        dpr={dpr}
        camera={{ position: [0, 1.55, -147.5], fov: 64, near: 0.1, far: 4000 }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <fog attach="fog" args={[FOG, 260, 2300]} />
        <PerformanceMonitor
          bounds={() => [45, 58]}
          flipflops={3}
          onDecline={() => setDpr((d) => Math.max(1, +(d - 0.25).toFixed(2)))}
          onIncline={() => setDpr((d) => Math.min(phoneLite ? 1 : 1.5, +(d + 0.25).toFixed(2)))}
          onFallback={() => setDpr(1)}
        />
        <AdaptiveEvents />
        <PauseWhenHidden />
        <Suspense fallback={null}>
          <Sky />
          <Lights />
          <Water lite={phoneLite} />
          <SunGlitter />
          <Skyline />
          <HeroSet />
          <Walker />
        </Suspense>
        {/* streams in after the hero is up (own Suspense: does not hold the loader) */}
        <FirstFrame />
        <Warmups />
        <MapWorld />
        <Interiors />
        <CameraRig />
        <SceneGrade grade={grade} bloom={bloom} />
        <TextureQuality />
        {/* Bloom on HDR values first, then ACES + golden grade, then vignette */}
        {lite ? (
          <EffectComposer multisampling={0} frameBufferType={HalfFloatType}>
            <GoldenGrade ref={grade} exposure={0.48} />
            <Vignette offset={0.32} darkness={0.28} />
          </EffectComposer>
        ) : (
          <EffectComposer multisampling={2} frameBufferType={HalfFloatType}>
            <Bloom ref={bloom} mipmapBlur luminanceThreshold={2.2} luminanceSmoothing={0.3} intensity={0.3} />
            <GoldenGrade ref={grade} exposure={0.48} />
            <Vignette offset={0.32} darkness={0.28} />
          </EffectComposer>
        )}
      </Canvas>
      <ReadyGate />
      <LoadLine />
      <HeroOverlay />
      <MapOverlay />
      <TopNav />
      <SidePanel />
      <HallUI />
      <SceneFade />
      <DebugGate />
      <StoryScroll />
    </>
  )
}
