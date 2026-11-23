import { useSyncExternalStore } from 'react'

/** Tiny global store (no extra dependency). */
/** hero = the scroll story (landing); map/building/hall = click-driven */
export type Phase = 'loading' | 'hero' | 'map' | 'building' | 'hall'
/** The four روافد (buildings you can visit). */
export type RafidKey = 'reciters' | 'library' | 'learning' | 'community'

type State = {
  phase: Phase
  ready: boolean
  /** map models finished loading (they load in the background while the hero shows) */
  mapReady: boolean
  /** building being visited (phase 'building'), or flying to */
  rafid: RafidKey | null
  /** map hover (label or building) */
  hover: RafidKey | null
  /** where we are at a building */
  view: 'entrance' | 'interior' | null
  /** hero parts that load after the first view (gateway, colonnade) are in */
  heroLate: boolean
  /** the opening intro (camera descent + logo/text reveal) is playing: page scroll is locked */
  heroIntro: boolean
  /** the camera has finished moving into the interior: panels may open */
  arrived: boolean
  /** interior shaders compiled + first frame rendered (never reveal before this) */
  interiorsWarm: boolean
  /** a camera flight / fade is running: navigation input is ignored */
  busy: boolean
  /** interior vignettes loaded (they stream in after the map) */
  interiorsReady: boolean
  /** map labels may show (the map title now lives in scroll section 2, so this starts true) */
  introDone: boolean
  /** HIGH LOD models requested (loaded lazily: flight start, hover, hero portal) */
  hi: Record<string, true>
}
let state: State = {
  phase: 'loading', ready: false, mapReady: false,
  rafid: null, hover: null, view: null, heroLate: false, heroIntro: false, arrived: false, interiorsWarm: false, busy: false, interiorsReady: false, introDone: true, hi: {},
}
const listeners = new Set<() => void>()

export const store = {
  get: () => state,
  set(patch: Partial<State>) {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(state), () => select(state))
}

/** Ask for the HIGH LOD of these models (no-op if already requested). */
export function requestHigh(...models: string[]) {
  const missing = models.filter((m) => !state.hi[m])
  if (missing.length) store.set({ hi: { ...state.hi, ...Object.fromEntries(missing.map((m) => [m, true as const])) } })
}
