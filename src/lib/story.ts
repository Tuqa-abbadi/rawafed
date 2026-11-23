import * as THREE from 'three'
import { HERO, HERO_TAN_HALF_V, LENS_SHIFT, HERO_MIN_TAN_HALF_H, mapCameraFor } from './layout'

/**
 * Scroll story (landing): scroll progress p (0..1) drives everything — scrubbed and reversible.
 *   0          the walker stands inside the gateway facing the sea (hero frame, nothing moves)
 *   WALK_START..WALK_END  he walks to the terrace edge, turns left and walks the shore colonnade;
 *                         the camera follows behind him
 *   RISE_START..1         the camera turns toward the city and rises in an arc around the island
 *                         into the aerial map pose (exactly), the walker fades out
 *   1          handoff to the click-driven map (labels + top nav)
 */
export const story = { p: 0 }

/**
 * Opening intro (once, after loading): the camera starts high above the gateway looking at the
 * sunset sky and descends into the hero framing. k = 1 at the top, 0 = the normal story camera.
 * Starts at 1 so the first frame after the loader is already the high shot (no jump).
 */
export const heroIntro = { k: 1, played: false }
const INTRO_RISE = 46 // m above the hero camera at the start


/**
 * Three scroll sections (video order, refs/video_frames t002–t012):
 *   1  [0, S2)        logo + "من منابع القرآن… إلى آفاق جديدة" + one line; the walker stands
 *   2  [S2, S3)       he walks through the arch and along the colonnade;
 *                     "مدينةٌ واحدة، وأربعة روافد للمعرفة" + one line
 *   3  [S3, 1]        the camera turns toward the city and rises into the aerial map
 */
export const S2 = 0.16
export const S3 = 0.53
export const WALK_START = S2
export const WALK_END = 0.53 // he stops under the last arch; the rise starts there
export const RISE_START = S3 // the camera has left the last arch by now (it rises in the open)
export const MAP_AT = 0.995 // phase 'map' from here (and back to 'hero' below 0.99)

/** Colonnade along the back shore, west of the gateway: arches in a row along -X (see HeroSet). */
export const COLONNADE = {
  z: -155.25, // corridor centre line
  x0: -7.4, // first arch
  spacing: 3.55,
  count: 4, // a short passage: through the arches, then straight into the world of Rawafed
  platform: { x0: -34, x1: -4.6, z0: -158.6 }, // stone pier in the sea, up to the terrace edge
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** Walker path: forward out of the gateway, a soft left turn at the terrace edge, then the colonnade. */
const WALK = new THREE.CatmullRomCurve3(
  [
    v(0, 0, -151.8), // standing inside the gateway (the hero frame)
    v(0, 0, -153.2),
    v(-1.4, 0, -154.25),
    v(-4.6, 0, -155.05),
    v(-8.5, 0, COLONNADE.z),
    v(-13.3, 0, COLONNADE.z),
    v(COLONNADE.x0 - COLONNADE.spacing * (COLONNADE.count - 1), 0, COLONNADE.z), // under the LAST arch: he stops here
  ],
  false,
  'centripetal',
)
const WALK_LENGTH = WALK.getLength()
export const STRIDE = 1.35 // metres per walk cycle (two steps) for a 1.8 m man

const clamp01 = (x: number) => THREE.MathUtils.clamp(x, 0, 1)
const smooth = (x: number, a: number, b: number) => THREE.MathUtils.smoothstep(x, a, b)

/** Walker pose at progress p: position, facing direction, distance walked (drives the clip). */
export function walkerAt(p: number) {
  const u = clamp01((p - WALK_START) / (WALK_END - WALK_START))
  const pos = WALK.getPointAt(u)
  const dir = WALK.getTangentAt(Math.min(u, 0.999)).setY(0).normalize()
  return { u, pos, dir, dist: u * WALK_LENGTH, opacity: 1 - smooth(p, S3 + 0.03, S3 + 0.1) }
}

export type Lens = { shift: number; tanV: number; minTanH: number }
export const HERO_LENS: Lens = { shift: LENS_SHIFT, tanV: HERO_TAN_HALF_V, minTanH: HERO_MIN_TAN_HALF_H }
const WALK_LENS: Lens = { shift: 1.18, tanV: 0.56, minTanH: 0.42 }

const lerpLens = (a: Lens, b: Lens, k: number): Lens => ({
  shift: THREE.MathUtils.lerp(a.shift, b.shift, k),
  tanV: THREE.MathUtils.lerp(a.tanV, b.tanV, k),
  minTanH: THREE.MathUtils.lerp(a.minTanH, b.minTanH, k),
})

/** Follow camera: behind the walker (lagging his turn a little), slightly to the land side. */
function follow(p: number) {
  const w = walkerAt(p)
  const lagU = Math.max(0, w.u - 0.035)
  const lagDir = WALK.getTangentAt(Math.min(lagU, 0.999)).setY(0).normalize()
  const k = smooth(w.u, 0, 0.12) // settle from the hero framing into the follow framing
  const back = THREE.MathUtils.lerp(4.65, 3.3, k)
  const height = THREE.MathUtils.lerp(HERO.camStart.y, 1.75, k)
  const left = v(-lagDir.z, 0, lagDir.x) // left of travel = land side on the colonnade
  const pos = w.pos.clone().addScaledVector(lagDir, -back).addScaledVector(left, 0.55 * k).setY(height)
  const look = w.pos.clone().addScaledVector(lagDir, 7).setY(THREE.MathUtils.lerp(height, 1.45, k))
  return { pos, look }
}

/** Camera pose + lens for progress p (aspect picks the portrait/landscape map pose for the end). */
export function storyCamera(p: number, aspect: number) {
  const lensIn = smooth(p, WALK_START, WALK_START + 0.1)
  if (p < RISE_START) {
    const f = follow(p)
    const k = heroIntro.k
    if (k > 0) {
      // high above the gateway, looking out at the sunset sky; descends straight down into the arch
      f.pos.y += INTRO_RISE * k
      f.pos.z += 4 * k
      f.look.y += INTRO_RISE * k * 1.08
    }
    return { ...f, lens: lerpLens(HERO_LENS, WALK_LENS, lensIn) }
  }

  // section 3: turn from the colonnade toward the CITY (the island, not the sea) and rise in an arc
  // around its west side, always looking at it, into the aerial map pose (which looks across the
  // island from the south)
  const map = mapCameraFor(aspect)
  const from = follow(RISE_START)
  const posCurve = new THREE.CatmullRomCurve3(
    [from.pos, v(-22, 6.5, -148), v(-62, 34, -118), v(-84, 70, -40), v(-48, 86, 40), map.position.clone()],
    false,
    'centripetal',
  )
  const lookCurve = new THREE.CatmullRomCurve3(
    [from.look, v(-34, 4, -126), v(-12, 6, -100), v(0, 0, -92), v(0, 0, -100), map.target.clone()],
    false,
    'centripetal',
  )
  const k = smooth(p, RISE_START, 1)
  const mapLens: Lens = { shift: 1, tanV: map.tanHalfV, minTanH: map.minTanHalfH }
  return {
    pos: posCurve.getPoint(k),
    look: lookCurve.getPoint(k),
    lens: lerpLens(WALK_LENS, mapLens, smooth(k, 0.15, 0.85)),
  }
}
