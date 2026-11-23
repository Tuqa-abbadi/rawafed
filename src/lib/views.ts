import * as THREE from 'three'
import { BUILDINGS } from './layout'
import type { RafidKey } from './store'
import { t } from './i18n'

/** Building data for the four روافد. Text comes from src/i18n/<lang>.json (getters: current language). */
type RafidText = { name: string; icon: 'mic' | 'book' | 'cap' | 'people'; line: string; body: string[]; features: string[]; cta?: string }
const ICONS: Record<RafidKey, RafidText['icon']> = { reciters: 'mic', library: 'book', learning: 'cap', community: 'people' }
function rafidText(id: RafidKey): RafidText {
  return {
    icon: ICONS[id],
    get name() { return t(`rafids.${id}.name`) },
    get line() { return t(`rafids.${id}.line`) },
    get body() { return t<string[]>(`rafids.${id}.body`) },
    get features() { return t<string[]>(`rafids.${id}.features`) },
    get cta() { return t(`rafids.${id}.cta`) },
  }
}
export const RAFIDS: Record<RafidKey, RafidText> = {
  reciters: rafidText('reciters'),
  library: rafidText('library'),
  learning: rafidText('learning'),
  community: rafidText('community'),
}

export const RAFID_ORDER: RafidKey[] = ['reciters', 'library', 'learning', 'community']

/** Which BUILDINGS entries belong to each رافد (glow together on hover). */
export const RAFID_PARTS: Record<RafidKey, (keyof typeof BUILDINGS)[]> = {
  reciters: ['reciters'],
  library: ['library'],
  learning: ['learning'],
  community: ['community'],
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** Unit vector a building's entrance faces (model front +Z, or -Z for learning.glb), after rotation. */
function frontDir(rotY: number, modelFront = 1) {
  return v(Math.sin(rotY) * modelFront, 0, Math.cos(rotY) * modelFront)
}

type Pose = { pos: THREE.Vector3; look: THREE.Vector3 }

/** Where a label floats (above the building) — world position. */
export const LABEL_ANCHOR: Record<RafidKey, THREE.Vector3> = {
  reciters: v(0, 47, -80), // on the front of the dome (t032); above it the pill would hide under the top nav
  library: v(-28, 32, -40),
  learning: v(-62, 24, -92),
  community: v(56, 40, -76),
}

/**
 * Entrance views (raw: centred on the door; see entranceFor for screen framing): camera in front of the facade, a little above eye level, looking at the door
 * (CLAUDE.md: the التعليم transition ends at learning.glb's facade).
 */
function entrance(center: number[], rotY: number, half: number, dist: number, h: number, lookH: number, modelFront = 1): Pose {
  const c = v(center[0], center[1], center[2])
  const d = frontDir(rotY, modelFront)
  return { pos: c.clone().addScaledVector(d, half + dist).setY(h), look: c.clone().addScaledVector(d, half * 0.35).setY(lookH) }
}

/**
 * The side panel covers the left ~third of the screen (video t044), so aim a little to the left of
 * the building: it then sits in the free right part of the frame.
 */
function frameRight(p: Pose, amount = 0.2): Pose {
  const f = p.look.clone().sub(p.pos)
  const right = f.clone().cross(v(0, 1, 0)).setY(0).normalize()
  return { pos: p.pos, look: p.look.clone().addScaledVector(right, -f.length() * amount) }
}

/** Portrait: the panel covers the bottom half, so aim lower — the building rises into the top half. */
function frameUp(p: Pose, amount = 0.3): Pose {
  const f = p.look.clone().sub(p.pos)
  return { pos: p.pos.clone().addScaledVector(f, -0.25), look: p.look.clone().add(v(0, -f.length() * amount, 0)) }
}

/** Entrance pose framed for this screen (panel left on landscape, bottom on portrait). */
export function entranceFor(id: RafidKey, aspect: number): Pose {
  const raw = ENTRANCE[id]
  return aspect < 0.85 ? frameUp(raw) : frameRight(raw, id === 'reciters' ? 0.17 : 0.2)
}

export const ENTRANCE: Record<RafidKey, Pose> = {
  // hovering low over the long pool, looking up at the great arch (video t102 facade)
  reciters: { pos: v(0, 9, -30), look: v(0, 19, -100) },
  library: entrance(BUILDINGS.library.pos as unknown as number[], BUILDINGS.library.rotY, 21, 24, 7, 10),
  learning: entrance(BUILDINGS.learning.pos as unknown as number[], BUILDINGS.learning.rotY, 12, 22, 5, 6, -1),
  community: entrance(BUILDINGS.community.pos as unknown as number[], BUILDINGS.community.rotY, 22.5, 26, 8, 11),
}

/** Interior vignettes live far behind the map camera (out of every other view). */
export const INTERIOR_ORIGIN: Record<RafidKey, THREE.Vector3> = {
  reciters: v(-420, 0, -150), // the hall stands on the water west of the island: its arches open on the sea + skyline
  library: v(-260, 0, 640),
  learning: v(0, 0, 640),
  community: v(260, 0, 640),
}
/**
 * Interior camera: both poses lie INSIDE the room (the fade lifts on the room, never on the sea
 * around the set), then a short slow dolly forward. Rooms: hall 30x20, library r13, class 18x14, majlis 20x16.
 */
export const INTERIOR_SHOT: Record<RafidKey, { from: Pose; to: Pose }> = {
  reciters: {
    from: { pos: v(0, 1.45, 5.2), look: v(0, 0.95, -3) },
    to: { pos: v(0, 1.25, 2.7), look: v(0, 0.86, -3) }, // eye level with the seated reciter
  },
  library: {
    from: { pos: v(0, 2.2, 10.5), look: v(0, 3.4, 0) },
    to: { pos: v(0, 2.0, 8.2), look: v(0, 3.6, 0) },
  },
  learning: {
    from: { pos: v(0, 2.4, 6.3), look: v(0, 2.3, -6) },
    to: { pos: v(0, 2.1, 4.8), look: v(0, 2.4, -6) },
  },
  community: {
    from: { pos: v(-4.2, 2.4, 7.2), look: v(0, 1.4, 0) },
    to: { pos: v(-2.5, 2.0, 5.8), look: v(0, 1.2, -1) },
  },
}

/** Spline from the aerial view to a building's entrance (and the same points reversed back). */
export function pathToEntrance(from: Pose, id: RafidKey, aspect = 16 / 9) {
  const to = entranceFor(id, aspect)
  const dir = to.pos.clone().sub(to.look).setY(0).normalize()
  const mid = from.pos.clone().lerp(to.pos, 0.45)
  mid.y = Math.max(mid.y, 55)
  const approach = to.pos.clone().addScaledVector(dir, 26).add(v(0, 14, 0))
  const pos = [from.pos.clone(), mid, approach, to.pos.clone()]
  const center = to.look.clone().addScaledVector(dir, -10)
  const look = [from.look.clone(), center.clone().setY(12), to.look.clone().lerp(center, 0.3), to.look.clone()]
  return { pos, look }
}

/** Distance (xz) from a point to the sight line of any entrance view, if within its length. */
export function inEntranceSightline(x: number, z: number, halfWidth = 7) {
  for (const id of RAFID_ORDER) {
    if (id === 'reciters') continue // high over the pool axis: the flanking palms frame that view
    const { pos, look } = ENTRANCE[id]
    const ax = pos.x, az = pos.z, bx = look.x, bz = look.z
    const dx = bx - ax, dz = bz - az
    const t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), -0.15, 1)
    const px = ax + dx * t, pz = az + dz * t
    const w = halfWidth + t * 6 // widens toward the building
    if ((x - px) ** 2 + (z - pz) ** 2 < w * w) return true
  }
  return false
}

/**
 * Doors (measured from each GLB with scripts/find_doors.mjs: depth scans of the facade along the
 * entrance axis). `door` = centre of the main entrance opening at EYE height (its floor + 1.7 m),
 * `facing` = unit vector out of the entrance. out = metres from the building origin along facing,
 * lateral = metres to the facade's right as seen from outside.
 */
const EYE = 1.7
function door(key: keyof typeof BUILDINGS, out: number, lateral: number, floorY: number, modelFront = 1) {
  const b = BUILDINGS[key]
  const facing = frontDir(b.rotY, modelFront)
  const right = v(-facing.z, 0, facing.x) // viewer's right when looking at the facade
  const p = v(b.pos[0], floorY + EYE, b.pos[2]).addScaledVector(facing, out).addScaledVector(right, lateral)
  return { door: p, facing }
}
export const DOOR: Record<RafidKey, { door: THREE.Vector3; facing: THREE.Vector3 }> = {
  reciters: door('reciters', -1, 0, 4.4), // the great arch at the top of the stairs (floor ~4.4 m)
  library: door('library', 4.5, 1.5, 3.7), // arched door on the raised plinth (opening ~4–6.8 m)
  learning: door('learning', 10, 1, 1.2, -1), // recessed portal (opening ~1.5–5 m)
  community: door('community', -1, 6, 1.4), // arcade bay right of the centre (the centre bay has a fountain in front)
}

/**
 * Flight INTO a building, in two parts (CLAUDE.md: never through the ground, walls or roofs):
 *  a) map -> a smooth descent to a point 10 m in front of the door, camera level at eye height,
 *     looking straight at the door
 *  b) forward through the door opening at eye height, on its axis, into the building
 * Returning = the same points reversed (back out through the door, then up to the map).
 */
export function pathInto(from: Pose, id: RafidKey) {
  const { door: d, facing: f } = DOOR[id]
  const front = d.clone().addScaledVector(f, 10)
  const approach = d.clone().addScaledVector(f, 32).add(v(0, 10, 0))
  const mid = from.pos.clone().lerp(approach, 0.5)
  mid.y = Math.max(mid.y * 0.85, approach.y + 12)
  const lookDoor = d.clone()
  const lookIn = d.clone().addScaledVector(f, -12)
  const descend = {
    pos: [from.pos.clone(), mid, approach, front],
    look: [from.look.clone(), lookDoor.clone().setY(d.y - 2), lookDoor.clone(), lookIn.clone()],
  }
  const through = {
    pos: [front.clone(), d.clone().addScaledVector(f, 1.5), d.clone().addScaledVector(f, -3)],
    look: [lookIn.clone(), lookIn.clone().addScaledVector(f, -4), lookIn.clone().addScaledVector(f, -10)],
  }
  return { descend, through, door: d.clone(), facing: f.clone() }
}
