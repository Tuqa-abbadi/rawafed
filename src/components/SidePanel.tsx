'use client'

import { useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import gsap from '@/lib/gsap'
import { useStore } from '@/lib/store'
import { RAFIDS } from '@/lib/views'
import { backToMap } from '@/lib/nav'
import { RafidIcon } from './RafidIcon'
import PanelToggle, { startCollapsed } from './PanelToggle'
import { t, useLang } from '@/lib/i18n'

/**
 * Dark-glass side panel shown on arrival at a building (video t044: panel on the left).
 * Its text scrolls with Lenis (only inside the panel; the 3D journey is click-driven).
 */
export default function SidePanel() {
  const phase = useStore((s) => s.phase)
  const rafid = useStore((s) => s.rafid)
  const view = useStore((s) => s.view)
  const arrived = useStore((s) => s.arrived)
  const busy = useStore((s) => s.busy)
  const lang = useLang()
  const [min, setMin] = useState(startCollapsed)
  // the reciters hall has its own UI (HallUI)
  const open = phase === 'building' && !!rafid && !!view && (view !== 'interior' || arrived) && !(rafid === 'reciters' && view === 'interior')
  const root = useRef<HTMLElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)

  // slide in / out
  useEffect(() => {
    if (!root.current) return
    const tw = open
      ? gsap.fromTo(root.current, { autoAlpha: 0, x: lang === 'ar' ? 24 : -24 }, { autoAlpha: 1, x: 0, duration: 0.7, ease: 'power3.out' })
      : gsap.to(root.current, { autoAlpha: 0, x: lang === 'ar' ? 16 : -16, duration: 0.35, ease: 'power2.in' })
    return () => {
      tw.kill()
    }
  }, [open, rafid, view]) // (not on a language switch: the panel just re-renders its text, no replayed slide-in)

  // Lenis smooth scrolling inside the panel only
  useEffect(() => {
    if (!open || !scroller.current || !content.current) return
    const lenis = new Lenis({ wrapper: scroller.current, content: content.current, autoRaf: true, smoothWheel: true })
    lenis.scrollTo(0, { immediate: true })
    return () => lenis.destroy()
  }, [open, rafid])

  const r = rafid ? RAFIDS[rafid] : null
  return (
    <aside ref={root} className={`side-panel glass${min ? ' is-min' : ''}`} aria-hidden={!open} aria-label={r?.name} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {r && (
        <div className="side-panel__scroll" ref={scroller}>
          <div className="side-panel__content" ref={content}>
            <div className="panel-top">
              <p className="side-panel__eyebrow">
                <RafidIcon name={r.icon} /> {t('panel.eyebrow')}
              </p>
              <PanelToggle collapsed={min} onToggle={() => setMin((v) => !v)} />
            </div>
            <h2 className="side-panel__title">{r.name}</h2>
            <p className="side-panel__line">{r.line}</p>
            {r.body.map((t, i) => (
              <p key={i} className="side-panel__body">
                {t}
              </p>
            ))}
            <ul className="side-panel__features">
              {r.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <div className="side-panel__actions">
              {rafid === 'reciters' && (
                <button type="button" className="btn-gold" disabled>
                  {r.cta}
                </button>
              )}
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => void backToMap()}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t('panel.back')}
                <kbd>Esc</kbd>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
