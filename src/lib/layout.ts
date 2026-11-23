import * as THREE from 'three'

/**
 * World layout (metres, +Y up). The city island is centred at (0,0,-80) (CLAUDE.md); the hero
 * gateway stands on its north shore and looks -Z across open water to the skyline, as in the
 * video opening (refs/video_frames/t002s–t006s). The aerial map camera (Stage 4) also looks -Z.
 */
export const HERO = {
  /** gateway_interior.glb base centre; its arch opening faces ±Z */
  gateway: new THREE.Vector3(0, 0, -151),
  /**
   * Portal = two ivory pillars framing a 2.9 m opening (video t002: inner edges at 17%/83% of the
   * frame from ~3 m away). Front faces at z = portalZ.
   */
  portalZ: -150.2,
  portalHalfOpening: 1.45,
  pillarWidth: 0.45, // t002: pillar face ~125 px of 1280, mashrabiya screens beyond it
  pillarDepth: 0.35, // inner faces only a sliver (t002/t004)
  pillarHeight: 12,
  /** pointed arch springs just above the top of the frame at the push-in start (t002 corners) */
  archSpring: 2.9,
  archRise: 2.1,
  /** gold mashrabiya screens beside the pillars (t002 frame edges) */
  mashrabiyaWidth: 3.4, // carved screens fill the frame sides (no plain wall left of the portal)
  mashrabiyaHeight: 9,
  /** camera start (3.2 m before the pillars) and end of the slow push-in (~t004). Low eye height
   *  (1.15 m): the walker's head sits well above the horizon in the video. */
  // t002: opening = 66% of the frame width -> 3.05 m from the portal; t004: 82% -> 2.45 m
  camStart: new THREE.Vector3(0, 1.15, -147.15),
  camEnd: new THREE.Vector3(0, 1.15, -147.75),
  /** looking straight ahead (verticals stay vertical; the low horizon comes from lens shift) */
  lookDir: new THREE.Vector3(0, 0, -1),
  /** terrace (marble) in front of the gateway ends at the sea wall */
  // the sea starts right behind the portal (t004: water fills the bottom of the frame)
  terraceFrontZ: -154.6,
  terraceTopY: 0,
  waterY: -0.3, // high water: the sea fills the bottom of the frame behind the walker (t004)
  /** walker path: from beyond the pillars to the water's edge (t004: ~half the frame height) */
  walkerFrom: new THREE.Vector3(0.1, 0, -151.6),
  walkerTo: new THREE.Vector3(0.1, 0, -154.1),
  walkerSpeed: 0.32, // m/s (slow, contemplative — video)
}

/**
 * Lens shift: the video keeps verticals vertical with the horizon ~76% down the frame.
 * We render the top part of a taller frustum: full height = visible height * LENS_SHIFT.
 * Calibrated from t004: sun 6° up at 25% from left; supertall top at 8% from top.
 */
export const LENS_SHIFT = 1.52
export const HERO_TAN_HALF_V = 0.62 // tan(half vertical fov) of the FULL (shifted) frustum
export const HERO_MIN_TAN_HALF_H = 0.5 // keep the supertall (19.5° right) in frame on narrow screens

/** Skyline across the bay, seen from the hero camera. Bearings in degrees (+ = right of -Z). */
export const SKYLINE = {
  origin: new THREE.Vector3(0, 0, -150),
  // further back with the skyline; scaled with distance so it keeps its size in the hero frame (t004)
  supertall: { bearing: 19.5, distance: 900, scale: 900 / 650 },
  /** filler towers: bearing range, distance range, count */
  // pushed back and spread out (video: a wide, hazy sunset skyline far across the bay)
  bearingMin: -58,
  bearingMax: 60,
  distMin: 820,
  distMax: 1250,
  count: 120,
  seed: 7,
  /** far shore across the bay: a low landmass the towers stand on (top above the sea) */
  shore: { y: 0.9, inner: 760, outer: 1760, promenade: 16, bearingMin: -70, bearingMax: 72 },
}

/** Positions on the skyline ring as world coordinates. */
export function skylinePoint(bearingDeg: number, distance: number) {
  const b = THREE.MathUtils.degToRad(bearingDeg)
  return new THREE.Vector3(
    SKYLINE.origin.x + Math.sin(b) * distance,
    SKYLINE.shore.y, // every tower stands ON the far shore, never below the water
    SKYLINE.origin.z - Math.cos(b) * distance,
  )
}

/**
 * City map (Stage 4). Island centred near (0,0,-83); every building's entrance faces +Z, toward
 * the aerial camera (video t032/t038). The hero portal sits on the island's back (north) shore.
 */
export const ISLAND = {
  // coastline: src/lib/island.ts (organic shape, straight only at the hero sea wall)
  groundY: -0.02, // a hair under the hero terrace (no z-fighting)
  sandWidth: 3, // thin sandy strip between the lawn and the rock edge
  promenadeInset: 7, // promenade band = 7..13 m inland, following the curved shore
  promenadeWidth: 6,
}

/**
 * Sea level guard: the sea surface must stay BELOW the island top and the hero terrace (the whole
 * city stands above the water). Everything that places the sea uses SEA_Y; it is clamped here, and
 * a wrong value is reported loudly instead of silently sinking the city.
 */
const SEA_MARGIN = 0.15 // metres the sea stays under the lowest walkable surface
const LOWEST_GROUND = Math.min(ISLAND.groundY, HERO.terraceTopY)
export const SEA_Y = Math.min(HERO.waterY, LOWEST_GROUND - SEA_MARGIN)
if (SKYLINE.shore.y <= SEA_Y + 0.3) {
  console.error(`[layout] far shore (${SKYLINE.shore.y} m) must stand above the sea (${SEA_Y} m)`)
}
if (HERO.waterY > LOWEST_GROUND - SEA_MARGIN) {
  console.error(`[layout] sea level ${HERO.waterY} m is not below the island/terrace (${LOWEST_GROUND} m): clamped to ${SEA_Y} m`)
}

export type Placement = { pos: [number, number, number]; rotY: number; scale: number }

export const BUILDINGS = {
  reciters: { model: 'reciters', pos: [0, 0, -100], rotY: 0, scale: 1 },
  // التعليم: learning.glb (gold wavy facade; the model faces -Z, so turned π) where the courtyard was,
  // facade toward the city centre / map camera
  learning: { model: 'learning', pos: [-62, 0, -92], rotY: Math.PI + 0.35, scale: 1.15 },
  community: { model: 'community', pos: [56, 0, -76], rotY: -0.35, scale: 1 },
  library: { model: 'library', pos: [-28, 0, -40], rotY: 0.15, scale: 1 },
} as const

/**
 * One long reflecting pool on the main axis: a wide basin over the القرّاء model's own pool
 * (model pool water ≈0.9 m, rim 1.2–1.3 m — our water sits just above and hides the rim), then a
 * channel down the axis toward the promenade. Raised basin with stone curbs; fountain jets along it.
 */
export const POOL = {
  x: 0,
  basin: { halfW: 11.8, z0: -86.6, z1: -61 },
  channel: { halfW: 5.5, z0: -61, z1: -20 },
  waterY: 1.27,
  curbH: 1.5,
  curbT: 0.7,
}

/** Round plaza + fountain in front of المجتمع. */
export const COMMUNITY_PLAZA = { x: 64, z: -40, r: 12 }

export const MAP_CAMERA = {
  // CLAUDE.md suggests ≈(0,112,46)->(0,0,-90); lower and further back so the whole island (all
  // four روافد) fits a 16:9 frame with the bay and skyline behind it (t012/t032 framing)
  position: new THREE.Vector3(0, 80, 92),
  target: new THREE.Vector3(0, 12, -112), // aimed a little high: the city sits lower, clear of the top nav
  tanHalfV: 0.36, // ~40° vertical fov
  minTanHalfH: 0.62, // portrait screens widen to keep the island in frame
}

/** Portrait screens: a steeper, higher view fills the tall frame with the island, not empty sea. */
export const MAP_CAMERA_PORTRAIT = {
  // phones: the SAME angled aerial view as desktop (same direction to the same target), pulled back
  // ~2x along it so the whole island fits the narrow width (CameraRig widens the vertical fov)
  position: new THREE.Vector3(0, 0, -112).addScaledVector(new THREE.Vector3(0, 80, 204), 2.05),
  target: new THREE.Vector3(0, 0, -112),
  tanHalfV: 0.36,
  minTanHalfH: 0.3,
}

export function mapCameraFor(aspect: number) {
  return aspect < 0.85 ? MAP_CAMERA_PORTRAIT : MAP_CAMERA
}
