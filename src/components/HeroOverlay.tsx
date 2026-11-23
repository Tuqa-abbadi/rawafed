'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from '@/lib/gsap'
import { store, useStore } from '@/lib/store'
import { MAP_AT, S2, S3, heroIntro, story } from '@/lib/story'
import { skipToMap } from '@/lib/nav'
import { t, useLang } from '@/lib/i18n'
import { DEBUG } from '@/lib/debug'

/**
 * Landing text, one block per scroll section (video order): section 1 logo + title + one line
 * (t002–t006), section 2 "مدينةٌ واحدة، وأربعة روافد للمعرفة" + one line (t008–t012); section 3 has
 * no text (the camera rises into the map). Scroll-linked and reversible.
 * "تخطي" jumps straight to the map.
 */
export default function HeroOverlay() {
  const phase = useStore((s) => s.phase)
  const mapReady = useStore((s) => s.mapReady)
  useLang()
  const root = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const sec2Ref = useRef<HTMLDivElement>(null)
  const [late, setLate] = useState(false) // reached the end before the map finished loading
  const [showSkip, setShowSkip] = useState(true)

  /**
   * Opening intro (once, right after loading): the camera descends from high above the gateway
   * into the arch (power3.out) while the logo moves down into place and fades in; then the title
   * and the subtitle rise into place; the scroll hint comes last. Page scroll is locked meanwhile;
   * a click, wheel, touch or key skips straight to the end. Later visits (الرئيسية) show it directly.
   */
  useEffect(() => {
    if (phase !== 'hero' || !root.current) return
    const q = gsap.utils.selector(root.current)
    const debug = DEBUG && /[?&](story|phase|at|into)=/.test(window.location.search)
    const full = !heroIntro.played && !debug && story.p < 0.01
    heroIntro.played = true
    if (!full) heroIntro.k = 0
    const DESCENT = 2.5
    const logo = document.getElementById('intro-logo')
    const sky = document.getElementById('intro-sky')
    const tl = gsap.timeline({
      delay: full ? 0.05 : 0,
      onComplete: () => {
        heroIntro.k = 0
        store.set({ heroIntro: false })
      },
    })
    if (full) {
      store.set({ heroIntro: true })
      heroIntro.k = 1
      // one continuous motion (~2.5 s, power3.out): the CSS sky dissolves into the 3D sky as the
      // camera descends, the SAME logo element drops into place, then the title and subtitle rise
      tl.to(heroIntro, { k: 0, duration: DESCENT, ease: 'power3.out' }, 0)
        .to(sky, { autoAlpha: 0, duration: 0.9, ease: 'power1.out' }, 0)
        .to(logo, { y: 0, duration: DESCENT, ease: 'power3.out' }, 0)
        .fromTo(q('.hero__title'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1.0, ease: 'power2.out' }, 0.9)
        .fromTo(q('.hero__sub'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1.0, ease: 'power2.out' }, 1.2)
        .fromTo(q('.scroll-hint, .skip-btn'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.7, ease: 'power2.out' }, DESCENT)
    } else {
      tl.set(sky, { autoAlpha: 0 })
        .to(logo, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(q('.hero__title, .hero__sub'), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.15, ease: 'power2.out' }, 0)
        .fromTo(q('.scroll-hint, .skip-btn'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.7, ease: 'power2.out' }, '-=0.3')
    }
    // any click / wheel / touch / key skips the intro instantly
    const skip = () => {
      if (tl.isActive() || tl.progress() < 1) tl.progress(1)
    }
    const evs = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const
    if (full) evs.forEach((e) => window.addEventListener(e, skip, { passive: true }))
    return () => {
      evs.forEach((e) => window.removeEventListener(e, skip))
      tl.kill()
      heroIntro.k = 0
      if (store.get().heroIntro) store.set({ heroIntro: false })
    }
  }, [phase])

  // scroll-linked: the text and the hint fade out over the first few percent of the story
  useEffect(() => {
    const tick = () => {
      const p = story.p
      if (textRef.current) {
        // section 1 text holds until the walk starts
        const k = 1 - gsap.utils.clamp(0, 1, (p - (S2 - 0.06)) / 0.06)
        textRef.current.style.opacity = String(k)
        textRef.current.style.transform = `translateY(${(1 - k) * -18}px)`
        // the single logo (page.tsx) belongs to the landing: it fades with section 1 and is gone
        // on the map / in buildings (the top-right logo takes over there)
        const logo = document.getElementById('intro-logo')
        const ph = store.get().phase
        if (logo) {
          const show = ph === 'hero' || ph === 'loading' ? k : 0
          logo.style.opacity = String(show)
          logo.style.visibility = show > 0.01 ? 'visible' : 'hidden'
        }
      }
      if (sec2Ref.current) {
        // section 2: in after the first steps, out before the camera turns to the city
        const a = gsap.utils.clamp(0, 1, (p - (S2 + 0.03)) / 0.06) * (1 - gsap.utils.clamp(0, 1, (p - (S3 - 0.08)) / 0.06))
        sec2Ref.current.style.opacity = String(a)
        sec2Ref.current.style.transform = `translateY(${(1 - a) * 12}px)`
        sec2Ref.current.style.visibility = a > 0.01 ? 'visible' : 'hidden'
      }
      if (hintRef.current) hintRef.current.style.opacity = String(1 - gsap.utils.clamp(0, 1, (p - 0.002) / 0.02))
      setShowSkip(p < 0.985)
      setLate(p >= MAP_AT && !store.get().mapReady)
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [])

  if (phase !== 'hero' && phase !== 'loading') return null
  return (
    <div className="hero" ref={root}>
      <div className="hero__text" ref={textRef}>
        {/* room for the single logo (page.tsx #intro-logo sits here) */}
        <div className="hero__logo-space" aria-hidden="true" />
        <h1 className="hero__title">
          {t('hero.titleA')} <span className="hero__title-gold">{t('hero.titleB')}</span>
        </h1>
        <p className="hero__sub">{t('hero.sub')}</p>
      </div>
      {/* section 2 (video t008–t012) */}
      <div className="hero__sec2" ref={sec2Ref}>
        <h2 className="hero__sec2-title">{t('hero.sec2Title')}</h2>
        <p className="hero__sub is-on">{t('hero.sec2Sub')}</p>
      </div>
      <div className="scroll-hint-wrap" ref={hintRef}>
      <div className="scroll-hint" aria-hidden="true">
        <i />
        <b />
        <span>{t('hero.scroll')}</span>
      </div>
      </div>
      {showSkip && (
        <button type="button" className="skip-btn glass is-pill" onClick={() => void skipToMap()}>
          {t('hero.skip')}
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M13 6l-6 6 6 6M19 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {late && !mapReady && <div className="hero__wait glass is-pill">{t('hero.wait')}</div>}
    </div>
  )
}
