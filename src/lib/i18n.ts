import { useSyncExternalStore } from 'react'
import ar from '@/i18n/ar.json'
import en from '@/i18n/en.json'

/**
 * UI language (Arabic default, RTL). All UI strings live in src/i18n/ar.json and en.json.
 * Switching sets <html lang/dir>, so the layout mirrors (logical CSS properties: panels sit on the
 * inline-start side = right in Arabic, left in English).
 */
export type Lang = 'ar' | 'en'
const DICTS: Record<Lang, unknown> = { ar, en }
let lang: Lang = 'ar'
const subs = new Set<() => void>()

function apply() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}

export function setLang(l: Lang) {
  if (l === lang) return
  lang = l
  apply()
  try {
    localStorage.setItem('rawafed.lang', l)
  } catch {
    /* storage unavailable: per-session only */
  }
  subs.forEach((f) => f())
}

/** call once on the client (restores the viewer's last choice) */
export function initLang() {
  try {
    const saved = localStorage.getItem('rawafed.lang')
    if (saved === 'en' || saved === 'ar') lang = saved
  } catch {
    /* default ar */
  }
  apply()
  subs.forEach((f) => f())
}

export const getLang = () => lang
export const isRtl = () => lang === 'ar'

/** t('hall.soon'), t('rafids.library.body') (arrays come back as-is) */
export function t<T = string>(key: string): T {
  let v: unknown = DICTS[lang]
  for (const k of key.split('.')) v = (v as Record<string, unknown> | undefined)?.[k]
  if (v === undefined) {
    let a: unknown = DICTS.ar
    for (const k of key.split('.')) a = (a as Record<string, unknown> | undefined)?.[k]
    return (a ?? key) as T
  }
  return v as T
}

/** re-render on language change; returns the current language */
export function useLang() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => lang,
    () => 'ar' as Lang,
  )
}
