'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from '@/lib/gsap'
import { useStore } from '@/lib/store'
import { RECITERS, SURAHS, hasAudio, player, useRecitation, type ReciterId } from '@/lib/recitation'
import { t, useLang } from '@/lib/i18n'
import { backToMap } from '@/lib/nav'
import { RafidIcon } from './RafidIcon'
import PanelToggle, { startCollapsed } from './PanelToggle'

const fmt = (s: number) => {
  const m = Math.floor(s / 60), r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

/** Small round portrait (drawn bust: the old reciter with a white beard, the young one without). */
function Portrait({ id }: { id: ReciterId }) {
  const old = id === 'old'
  return (
    <svg className="hall-portrait" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill={old ? '#4a3524' : '#3a2c22'} />
      <path d="M8 48c1-10 8-14 16-14s15 4 16 14z" fill="#f4ece0" />
      <path d="M13 22c0-8 5-12 11-12s11 4 11 12l-2 6H15z" fill="#f4ece0" />
      <ellipse cx="24" cy="22.5" rx="6.6" ry="7.6" fill="#c89a72" />
      {old ? <path d="M17.6 24c0 6 3 10.5 6.4 10.5s6.4-4.5 6.4-10.5c-1.6 2.2-3.8 3.2-6.4 3.2s-4.8-1-6.4-3.2z" fill="#eae6df" /> : <path d="M18.4 25.5c.6 4 2.8 6.6 5.6 6.6s5-2.6 5.6-6.6c-1.5 1.4-3.4 2-5.6 2s-4.1-.6-5.6-2z" fill="#2b1d14" />}
      <path d="M13.5 18.5c2-4.5 6-6.2 10.5-6.2s8.5 1.7 10.5 6.2c-3-1.3-6.6-2-10.5-2s-7.5.7-10.5 2z" fill="#c9963f" opacity="0.85" />
    </svg>
  )
}

const PlayIcon = ({ on }: { on: boolean }) =>
  on ? (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M17 12 8 18V6z" fill="currentColor" /></svg>
  )

/**
 * Reciters hall UI (dark glass, RTL; video t140–t164). RIGHT: the reciters (portrait, name, line);
 * under the selected one his riwaya/style tags and the surahs he recites, each with a play button.
 * Bottom: the player with the real reciter's credit. Selecting a reciter crossfades the model.
 */
export default function HallUI() {
  const phase = useStore((s) => s.phase)
  const rafid = useStore((s) => s.rafid)
  const view = useStore((s) => s.view)
  const busy = useStore((s) => s.busy)
  const arrived = useStore((s) => s.arrived)
  const open = phase === 'building' && rafid === 'reciters' && view === 'interior' && arrived
  const reciter = useRecitation((s) => s.reciter)
  const surah = useRecitation((s) => s.surah)
  const playing = useRecitation((s) => s.playing)
  const time = useRecitation((s) => s.time)
  const duration = useRecitation((s) => s.duration)
  const loading = useRecitation((s) => s.loading)
  const root = useRef<HTMLDivElement>(null)
  const lang = useLang()
  const [min, setMin] = useState(startCollapsed)

  useEffect(() => {
    if (!root.current) return
    const q = gsap.utils.selector(root.current)
    const tw = open
      ? gsap.fromTo(q('.hall-panel, .hall-player'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' })
      : gsap.to(q('.hall-panel, .hall-player'), { autoAlpha: 0, duration: 0.3 })
    return () => {
      tw.kill()
    }
  }, [open])

  useEffect(() => {
    if (!playing) return
    const tick = () => {
      player.tick()
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [playing])

  const r = RECITERS.find((x) => x.id === reciter)!
  const s = SURAHS.find((x) => x.id === surah)!
  const credit = hasAudio(reciter, surah) ? r.credit : ''
  return (
    <>
    {/* soft dark dip that hides the reciter swap (under the hall UI) */}
    <div className="hall-dip" aria-hidden="true" />
    <div className="hall-ui" ref={root} aria-hidden={!open} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <aside className={`hall-panel glass${min ? ' is-min' : ''}`} aria-label={t('hall.title')}>
        <div className="panel-top">
          <p className="side-panel__eyebrow">
            <RafidIcon name="mic" /> {min ? RECITERS.find((x) => x.id === reciter)!.name : t('hall.title')}
          </p>
          <PanelToggle collapsed={min} onToggle={() => setMin((v) => !v)} />
        </div>
        <h3 className="hall-panel__h">{t('hall.choose')}</h3>
        <div className="hall-panel__list" role="radiogroup" aria-label={t('hall.reciters')}>
          {RECITERS.map((x) => {
            const sel = x.id === reciter
            return (
              <div key={x.id} className={`hall-reciter${sel ? ' is-active' : ''}`}>
                <button type="button" role="radio" aria-checked={sel} className="hall-reciter__head" onClick={() => !sel && void player.switchReciter(x.id)}>
                  <Portrait id={x.id} />
                  <span className="hall-reciter__text">
                    <strong>{x.name}</strong>
                    <small>{x.line}</small>
                  </span>
                </button>
                {sel && (
                  <div className="hall-reciter__body">
                    <div className="hall-tags">
                      <span className="hall-tag">{t('hall.riwaya')} {x.riwaya}</span>
                      <span className="hall-tag is-soft">{x.style}</span>
                    </div>
                    <p className="hall-reciter__bio">{x.bio}</p>
                    <ul className="hall-surahs" aria-label={t('hall.surahs')}>
                      {SURAHS.map((y) => {
                        const on = playing && surah === y.id
                        return (
                          <li key={y.id} className={surah === y.id ? 'is-active' : ''}>
                            <span>{t('hall.surah')} {y.name}</span>
                            {!hasAudio(x.id, y.id) && <em>{t('hall.soon')}</em>}
                            <button
                              type="button"
                              className="hall-surahs__play"
                              disabled={!hasAudio(x.id, y.id)}
                              aria-label={`${on ? t('hall.pause') : t('hall.play')} — ${t('hall.surah')} ${y.name}`}
                              onClick={() => void player.playSurah(y.id)}
                            >
                              <PlayIcon on={on} />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <button type="button" className="btn-ghost hall-panel__back" disabled={busy} onClick={() => void backToMap()}>
          {t('hall.back')} <kbd>Esc</kbd>
        </button>
      </aside>

      <div className="hall-player glass" role="group" aria-label={t('hall.player')}>
        <button type="button" className="hall-player__play" aria-label={playing ? t('hall.pause') : t('hall.play')} disabled={!hasAudio(reciter, surah)} onClick={() => void player.toggle()}>
          <PlayIcon on={playing} />
        </button>
        <div className="hall-player__meta">
          <div className="hall-player__title">
            {t('hall.surah')} {s.name} <span>— {r.name}</span>
            {!hasAudio(reciter, surah) && <em>{t('hall.soon')}</em>}
          </div>
          <input
            type="range"
            className="hall-player__seek"
            min={0}
            max={1000}
            value={duration ? Math.round((time / duration) * 1000) : 0}
            onChange={(e) => player.seek(Number(e.target.value) / 1000)}
            aria-label={t('hall.seek')}
            dir="ltr"
          />
          <div className="hall-player__time" dir="ltr">
            <span>{fmt(time)}</span>
            <span>{loading ? '…' : duration ? fmt(duration) : '--:--'}</span>
          </div>
          {credit && <p className="hall-player__credit">{credit}</p>}
        </div>
      </div>
    </div>
    </>
  )
}
