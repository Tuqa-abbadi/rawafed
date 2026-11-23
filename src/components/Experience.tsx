'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { HalfFloatType } from 'three'
import HeroOverlay from './HeroOverlay'
import Sky from './Sky'
import { GoldenGrade, type GoldenGradeEffect } from '@/effects/GoldenGrade'
import type { BloomEffect } from 'postprocessing'
import SceneGrade from '@/scene/SceneGrade'
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
  useEffect(() => {
    const el = document.getElementById('intro-progress')
    if (!el) return
    const bar = el.firstElementChild as HTMLElement | null
    if (bar) bar.style.transform = `scaleX(${Math.max(0.04, progress / 100)})`
    el.classList.toggle('is-done', phase !== 'loading')
  }, [progress, phase])
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
  const lite = useMemo(() => typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820), [])
  return (
    <>
      <Canvas
        shadows={lite ? false : 'soft'}
        dpr={lite ? 1 : [1, 1.5]}
        camera={{ position: [0, 1.55, -147.5], fov: 64, near: 0.1, far: 4000 }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <fog attach="fog" args={[FOG, 260, 2300]} />
        <Suspense fallback={null}>
          <Sky />
          <Lights />
          <Water lite={lite} />
          <SunGlitter />
          <Skyline />
          <HeroSet />
          <Walker />
        </Suspense>
        {/* streams in after the hero is up (own Suspense: does not hold the loader) */}
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
          <EffectComposer multisampling={4} frameBufferType={HalfFloatType}>
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
