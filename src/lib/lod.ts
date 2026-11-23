import { BUILDINGS } from './layout'
import type { RafidKey } from './store'
import { RAFID_PARTS } from './views'

/**
 * Models with a HIGH LOD in public/models/hi/ (~300k tris, 2k maps; scripts/build_lod.mjs).
 * LOW (public/models/<name>.glb) is used from the air; HIGH swaps in near the camera.
 */
// Off for now: these models are exported at full quality (scripts/build_full.mjs) and used everywhere.
// Stage 7 brings LOD back (a lighter far version + lazy loading); the swap code is kept for that.
export const HAS_HIGH = new Set<string>()

/** Camera distance (m, to the model origin = base centre) under which HIGH is shown. */
export const LOD_DISTANCE: Record<string, number> = {
  reciters: 120, // entrance view ~72 m from its origin (the building is 75 m deep)
  library: 95,
  learning: 85,
  courtyard_complex: 95,
  community: 95,
  gateway_interior: 60,
  hall_arch_wall: 60,
}

export const highUrl = (model: string) => `/models/hi/${model}.glb`

/** GLB model names of a رافد (for requestHigh). */
export function modelsOf(id: RafidKey) {
  return RAFID_PARTS[id].map((k) => BUILDINGS[k].model)
}
