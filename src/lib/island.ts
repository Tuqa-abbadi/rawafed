import * as THREE from 'three'
import { HERO } from './layout'

/**
 * Organic island coastline (polar around the island centre): a soft superellipse with gentle
 * wobble, two small bays, a short peninsula, and a dead-straight stretch on the back shore where
 * the hero portal's sea wall stands (the hero view must stay exactly as it is).
 * Angle θ: 0 = +X (right), +90° = +Z (front, toward the map camera), -90° = back (hero side).
 */
export const ISLAND_CENTER = { x: 0, z: -82 }
const A = 100 // half width (x)
const B = 74 // half depth (z): back shore at -156, front at -8
const N = 3.2 // superellipse exponent (rounded rectangle-ish, soft corners)

/** Hero sea wall stretch: x range where the back shore is straight at z = HERO.terraceFrontZ. */
const HERO_X0 = -58
const HERO_X1 = 28

const bumps: { at: number; width: number; amount: number }[] = [
  { at: 128, width: 9, amount: -13 }, // small bay, front-left (between التعليم and المكتبة)
  { at: 12, width: 8, amount: -11 }, // small bay, right side
  { at: -24, width: 6, amount: 17 }, // short peninsula, right-back
  { at: 205, width: 7, amount: 7 }, // soft headland, left
]

const deg = THREE.MathUtils.degToRad

function wrapDeg(a: number) {
  return ((((a + 180) % 360) + 360) % 360) - 180
}

/** Base coastline radius at angle θ (radians), before the hero clamp. */
function baseRadius(t: number) {
  const c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t))
  let r = Math.pow(Math.pow(c / A, N) + Math.pow(s / B, N), -1 / N)
  r *= 1 + 0.018 * Math.sin(3 * t + 1.3) + 0.014 * Math.sin(5 * t + 0.4) + 0.008 * Math.sin(9 * t + 2.1)
  const d = THREE.MathUtils.radToDeg(t)
  for (const b of bumps) {
    const dd = wrapDeg(d - b.at)
    r += b.amount * Math.exp(-(dd * dd) / (2 * b.width * b.width))
  }
  return r
}

/** Weight (0..1) of the straight hero sea wall at this angle. */
function heroWeight(t: number, r: number) {
  const x = ISLAND_CENTER.x + Math.cos(t) * r
  if (Math.sin(t) >= -0.2) return 0
  return THREE.MathUtils.smoothstep(x, HERO_X0 - 10, HERO_X0) * (1 - THREE.MathUtils.smoothstep(x, HERO_X1, HERO_X1 + 10))
}

/**
 * Coastline radius at θ, pushed out by `offset` metres (negative = inland). On the hero stretch
 * the shore is the straight sea wall and outward offsets are suppressed (no sand/rocks there).
 */
export function shoreRadius(t: number, offset = 0) {
  const r0 = baseRadius(t)
  const w = heroWeight(t, r0)
  const s = Math.sin(t)
  const rWall = s < -0.05 ? (HERO.terraceFrontZ - ISLAND_CENTER.z) / s : r0
  const r = THREE.MathUtils.lerp(r0, Math.min(r0, rWall), w)
  return r + (offset > 0 ? offset * (1 - w) : offset)
}

/** Closed outline [x, z][] (counter-clockwise seen from above), `n` samples. */
export function shoreOutline(offset = 0, n = 220): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const r = shoreRadius(t, offset)
    pts.push([ISLAND_CENTER.x + Math.cos(t) * r, ISLAND_CENTER.z + Math.sin(t) * r])
  }
  return pts
}

/** Distance inland from the shore (metres, radial approximation); negative = in the water. */
export function inland(x: number, z: number) {
  const dx = x - ISLAND_CENTER.x, dz = z - ISLAND_CENTER.z
  const t = Math.atan2(dz, dx)
  return shoreRadius(t) - Math.hypot(dx, dz)
}

/** Shape (XY, y = -z) for ground geometry from an outline; optional hole outline. */
export function outlineShape(pts: [number, number][], hole?: [number, number][]) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))
  if (hole) s.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))))
  return s
}

/** Front-shore z at a given x (for features that must run to the water, e.g. the canal). */
export function frontShoreZ(x: number) {
  let best = -Infinity
  for (const [px, pz] of shoreOutline(0, 720)) if (Math.abs(px - x) < 0.8 && pz > best) best = pz
  return best
}

export { deg }

/** Points every `step` metres (arc length) along the coastline pushed out by `offset`. */
export function shorePoints(offset: number, step: number): [number, number][] {
  const pts = shoreOutline(offset, 1440)
  const out: [number, number][] = []
  let acc = step // emit the first point
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length]
    if (acc >= step) {
      out.push([x0, z0])
      acc = 0
    }
    acc += Math.hypot(x1 - x0, z1 - z0)
  }
  return out
}

/** True on the straight hero sea-wall stretch (no sand, rocks or shore palms there). */
export function onHeroWall(x: number, z: number) {
  return z < HERO.terraceFrontZ + 18 && x > -68 && x < 38
}

/** Front z (toward +Z) where the land is exactly `depth` metres inland at this x. */
export function frontZAtInland(x: number, depth: number) {
  let z = 30
  while (inland(x, z) < depth && z > -150) z -= 0.25
  return z
}
