import { useSyncExternalStore } from 'react'
import { t } from './i18n'
import gsap from './gsap'

/**
 * Reciters hall audio (Stage 6). Real recordings only, from /audio/<reciter>/<surah>.mp3 (AVAILABLE):
 * the file plays from its very start (the reciter's own basmala; nothing is prepended). Surahs with
 * no file play nothing. A Web Audio AnalyserNode gives the loudness that drives the reciter's jaw
 * and head. Audio starts only on a user click (browser autoplay rules).
 */

export type ReciterId = 'old' | 'young'
export type Reciter = { id: ReciterId; name: string; line: string; riwaya: string; style: string; bio: string; credit: string; model: string }
/** Real recordings only (public/audio/<reciter>/<surah>.mp3). Anything else shows "قريبًا" and plays nothing. */
export const AVAILABLE: Record<ReciterId, string[]> = { old: ['fatiha'], young: ['fatiha'] }
export const hasAudio = (reciter: ReciterId, surah: string) => AVAILABLE[reciter].includes(surah)
function reciter(id: ReciterId, model: string): Reciter {
  return {
    id,
    model,
    get name() { return t(`reciters.${id}.name`) },
    get line() { return t(`reciters.${id}.line`) },
    get riwaya() { return t(`reciters.${id}.riwaya`) },
    get style() { return t(`reciters.${id}.style`) },
    get bio() { return t(`reciters.${id}.bio`) },
    get credit() { return t(`reciters.${id}.credit`) },
  }
}
export const RECITERS: Reciter[] = [reciter('old', 'reciter_old'), reciter('young', 'reciter_young')]
const surah = (id: string) => ({ id, get name() { return t(`surahs.${id}`) } })
export const SURAHS = [surah('fatiha'), surah('baqarah'), surah('yasin'), surah('mulk')]

type State = { reciter: ReciterId; surah: string; playing: boolean; time: number; duration: number; loading: boolean }
let state: State = { reciter: 'old', surah: 'fatiha', playing: false, time: 0, duration: 0, loading: false }
const subs = new Set<() => void>()
const set = (p: Partial<State>) => {
  state = { ...state, ...p }
  subs.forEach((f) => f())
}
export const useRecitation = <T,>(sel: (s: State) => T) =>
  useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => sel(state), () => sel(state))
export const recitation = { get: () => state }

let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let gain: GainNode | null = null
let buffer: AudioBuffer | null = null
let source: AudioBufferSourceNode | null = null
let startedAt = 0 // ctx time when playback (re)started
let offset = 0 // seconds into the buffer at startedAt
const cache = new Map<string, AudioBuffer>()
const data = new Uint8Array(1024)
let switching = false

function ensureCtx() {
  if (!ctx) {
    ctx = new AudioContext()
    analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    gain = ctx.createGain()
    gain.gain.value = 0.9
    gain.connect(analyser)
    analyser.connect(ctx.destination)
  }
  return ctx
}

/** decode the real file (no placeholder: a surah without a file plays nothing) */
async function load(reciter: ReciterId, surah: string) {
  const key = `${reciter}/${surah}`
  const hit = cache.get(key)
  if (hit) return hit
  if (!hasAudio(reciter, surah)) return null
  set({ loading: true })
  const c = ensureCtx()
  let buf: AudioBuffer | null = null
  try {
    const r = await fetch(`/audio/${key}.mp3`)
    if (r.ok) buf = await c.decodeAudioData(await r.arrayBuffer())
  } catch {
    buf = null
  }
  set({ loading: false })
  if (!buf) return null
  cache.set(key, buf)
  return buf
}

function stopSource() {
  if (source) {
    source.onended = null
    try {
      source.stop()
    } catch {
      /* already stopped */
    }
    source.disconnect()
    source = null
  }
}

function startAt(at: number) {
  const c = ensureCtx()
  stopSource()
  if (!buffer || !gain) return
  source = c.createBufferSource()
  source.buffer = buffer
  source.connect(gain)
  source.onended = () => {
    if (state.playing && currentTime() >= buffer!.duration - 0.05) {
      set({ playing: false, time: 0 })
      offset = 0
    }
  }
  offset = Math.min(Math.max(at, 0), buffer.duration - 0.01)
  startedAt = c.currentTime
  source.start(0, offset)
}

function currentTime() {
  if (!ctx || !buffer) return 0
  return state.playing ? Math.min(offset + (ctx.currentTime - startedAt), buffer.duration) : offset
}

/** warm the HTTP cache with every recording (no AudioContext before a user gesture: no console warning) */
export function prefetchAudio() {
  for (const r of Object.keys(AVAILABLE) as ReciterId[]) for (const s of AVAILABLE[r]) void fetch(`/audio/${r}/${s}.mp3`).catch(() => {})
}

export const player = {
  /** decode every available recording ahead of time (called as the flight into the hall starts) */
  async preload() {
    await Promise.all((Object.keys(AVAILABLE) as ReciterId[]).flatMap((r) => AVAILABLE[r].map((s) => load(r, s))))
  },
  async play() {
    const c = ensureCtx()
    await c.resume()
    if (!buffer) {
      const key = `${state.reciter}/${state.surah}`
      const buf = await load(state.reciter, state.surah)
      if (`${state.reciter}/${state.surah}` !== key || !buf) return // changed while loading, or no recording
      buffer = buf
      set({ duration: buffer.duration })
    }
    startAt(offset)
    set({ playing: true })
  },
  pause() {
    offset = currentTime()
    stopSource()
    set({ playing: false, time: offset })
  },
  toggle() {
    return state.playing ? this.pause() : this.play()
  },
  seek(frac: number) {
    if (!buffer) return
    const at = frac * buffer.duration
    if (state.playing) startAt(at)
    else offset = at
    set({ time: at })
  },
  async choose(p: { reciter?: ReciterId; surah?: string }) {
    const wasPlaying = state.playing
    this.pause()
    offset = 0
    buffer = null
    set({ ...p, time: 0, duration: 0 })
    if (wasPlaying) await this.play()
  },
  /**
   * Switch reciter cleanly (~0.6 s): the recitation fades out, a soft dark dip (.hall-dip, under
   * the UI) covers the instant model swap, then the dip lifts and the new recitation starts.
   * No camera or light change.
   */
  async switchReciter(id: ReciterId) {
    if (id === state.reciter || switching) return
    switching = true
    const wasPlaying = state.playing
    const dip = typeof document !== 'undefined' ? document.querySelector('.hall-dip') : null
    if (gain && ctx && wasPlaying) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.07)
    await new Promise<void>((r) => (dip ? gsap.to(dip, { autoAlpha: 1, duration: 0.25, ease: 'power1.in', onComplete: r }) : r()))
    this.pause()
    offset = 0
    buffer = null
    const surah = hasAudio(id, state.surah) ? state.surah : AVAILABLE[id][0]
    set({ reciter: id, surah, time: 0, duration: 0 })
    if (gain && ctx) gain.gain.setValueAtTime(0.9, ctx.currentTime)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))) // swapped frame drawn
    if (dip) gsap.to(dip, { autoAlpha: 0, duration: 0.35, ease: 'power1.out' })
    switching = false
    if (wasPlaying) await this.play()
  },
  /** play this reciter's surah from its very start (the file itself, nothing prepended) */
  async playSurah(surah: string) {
    if (!hasAudio(state.reciter, surah)) return
    if (state.surah === surah && buffer) {
      if (state.playing) return this.pause()
      return this.play()
    }
    this.pause()
    offset = 0
    buffer = null
    set({ surah, time: 0, duration: 0 })
    await this.play()
  },
  stop() {
    this.pause()
  },
  /** current time for the UI (call every frame) */
  tick() {
    const t = currentTime()
    if (state.playing && Math.abs(t - state.time) > 0.2) set({ time: t })
    return t
  },
  /** 0..1 loudness of the real recording for the jaw/head (smoothed by the caller) */
  level() {
    if (!analyser || !state.playing) return 0
    analyser.getByteTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128
      sum += v * v
    }
    return Math.min(1, Math.sqrt(sum / data.length) * 3.2)
  },
}
