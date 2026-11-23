'use client'

import { useEffect } from 'react'
import { useStore, store } from '@/lib/store'
import { RAFID_ORDER, RAFIDS } from '@/lib/views'
import { goBack, goHome, goToRafid } from '@/lib/nav'
import Logo from './Logo'
import { initLang, setLang, t, useLang } from '@/lib/i18n'
import { RafidIcon } from './RafidIcon'

/** Top navigation bar (video): الرئيسية + the four روافد; triggers the same flights as the labels. */
export default function TopNav() {
  const phase = useStore((s) => s.phase)
  const rafid = useStore((s) => s.rafid)
  const busy = useStore((s) => s.busy)
  const show = phase === 'map' || phase === 'building' || phase === 'hall'
  const lang = useLang()

  useEffect(() => initLang(), [])

  // Esc = back to the city
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !store.get().busy) goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {/* fixed corners in both languages: logo top-right, language switch top-left */}
      <div className={`corner-logo${show ? ' is-on' : ''}`} aria-hidden={!show}>
        <Logo tone="metal" width={44} />
      </div>
      <div className="lang-switch glass is-pill" role="group" aria-label={t('lang.switch')}>
        <button type="button" lang="ar" aria-pressed={lang === 'ar'} className={lang === 'ar' ? 'is-active' : ''} onClick={() => setLang('ar')}>
          AR
        </button>
        <span aria-hidden="true">|</span>
        <button type="button" lang="en" aria-pressed={lang === 'en'} className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>
          EN
        </button>
      </div>
    <header className={`top-nav glass${show ? ' is-on' : ''}`} aria-hidden={!show}>
      <nav aria-label={t('nav.label')}>
        <button type="button" className="top-nav__item" disabled={busy} tabIndex={show ? 0 : -1} onClick={() => void goHome()}>
          <RafidIcon name="home" />
          <span>{t('nav.home')}</span>
        </button>
        {RAFID_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={`top-nav__item${rafid === id ? ' is-active' : ''}`}
            aria-current={rafid === id ? 'page' : undefined}
            disabled={busy}
            tabIndex={show ? 0 : -1}
            onClick={() => void goToRafid(id)}
          >
            <RafidIcon name={RAFIDS[id].icon} />
            <span>{RAFIDS[id].name}</span>
          </button>
        ))}
      </nav>
    </header>
    </>
  )
}
