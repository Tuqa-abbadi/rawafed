'use client'

import { useEffect, useRef } from 'react'
import gsap from '@/lib/gsap'
import { store, useStore } from '@/lib/store'
import { t, useLang } from '@/lib/i18n'

/**
 * First arrival on the map (video t012): title + subtitle, then they make way for the 3D labels
 * floating above each building (Labels.tsx). Plays once; later visits show the labels directly.
 */
export default function MapOverlay() {
  const phase = useStore((s) => s.phase)
  const root = useRef<HTMLDivElement>(null)

  const introDone = useStore((s) => s.introDone)
  useLang()

  useEffect(() => {
    if (phase !== 'map' || introDone || !root.current) return
    const q = gsap.utils.selector(root.current)
    const tl = gsap.timeline({ onComplete: () => store.set({ introDone: true }) })
    tl.fromTo(q('.map-intro__title'), { autoAlpha: 0, y: 10, filter: 'blur(6px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'power2.out' })
      .fromTo(q('.map-intro__sub'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9 }, '-=0.6')
      .to(q('.map-intro__title, .map-intro__sub'), { autoAlpha: 0, y: -8, duration: 0.8, ease: 'power2.in' }, '+=2.2')
    return () => {
      tl.kill()
    }
  }, [phase, introDone])

  if (phase !== 'map' || introDone) return null
  return (
    <div className="map-intro" ref={root}>
      <h2 className="map-intro__title">{t('hero.sec2Title')}</h2>
      <p className="map-intro__sub">{t('hero.sec2Sub')}</p>
    </div>
  )
}
