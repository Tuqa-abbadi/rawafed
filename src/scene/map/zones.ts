import { HERO, ISLAND, POOL, COMMUNITY_PLAZA } from '@/lib/layout'
import { frontShoreZ, frontZAtInland, inland } from '@/lib/island'
import { inEntranceSightline } from '@/lib/views'

/** Building footprints as circles (x, z, r) — vegetation keeps out of them. */
export const FOOTPRINTS: [number, number, number][] = [
  [0, -100, 41], // القرّاء
  [-62, -92, 27], // التعليم (learning.glb)
  [56, -76, 29], // المجتمع
  [-28, -40, 23], // المكتبة
]

function promenadeEdge(x: number) {
  return frontZAtInland(x, ISLAND.promenadeInset + ISLAND.promenadeWidth - 1)
}

/** Paved rectangles [x0, x1, z0, z1] (z0 < z1). */
export const PAVED: [number, number, number, number][] = [
  // entrance paths end where they meet the curved promenade (+1 m overlap)
  [-10, 10, -64, promenadeEdge(0)], // main axis to القرّاء
  [-32, 32, -68, -60], // forecourt of القرّاء
  [-31, -25, -19, promenadeEdge(-28)], // to المكتبة
  [-55, -49, -80, promenadeEdge(-52)], // to التعليم
  [61, 67, -30, promenadeEdge(64)], // to المجتمع plaza
  [-50, 20, HERO.terraceFrontZ, HERO.terraceFrontZ + 30], // hero terrace (marble)
]

/** Canal along z on the right of the axis (t012: canal + arched bridges). */
export const CANAL = { x: 26, width: 8, z0: -58, z1: frontShoreZ(26) + 2.5 } // runs out into the sea
export const BRIDGES_Z = [-15, -33, -50]

/** Fillers (instanced Meshy models). Rotations in radians. */
export const FILLERS = {
  domed_hall: [
    { pos: [62, 0, -124], rotY: -0.25, scale: 0.85 },
    { pos: [-84, 0, -142], rotY: 0.3, scale: 0.75 },
  ],
  pavilion_small: [
    { pos: [44, 0, -26], rotY: 0.4, scale: 0.7 },
    { pos: [90, 0, -106], rotY: -0.6, scale: 0.75 },
    { pos: [36, 0, -146], rotY: 0.1, scale: 0.65 },
  ],
  minaret: [
    { pos: [-38, 0, -66], rotY: 0, scale: 0.9 },
    { pos: [38, 0, -66], rotY: 0, scale: 0.9 },
  ],
  pergola: [
    { pos: [-12, 0, -30], rotY: Math.PI / 2, scale: 1.4 },
    { pos: [12, 0, -30], rotY: Math.PI / 2, scale: 1.4 },
    { pos: [-12, 0, -52], rotY: Math.PI / 2, scale: 1.4 },
    { pos: [12, 0, -52], rotY: Math.PI / 2, scale: 1.4 },
  ],
  bridge: BRIDGES_Z.map((z) => ({ pos: [CANAL.x, -0.25, z], rotY: 0, scale: 0.8 })),
} as const

const EXTRA_FREE: [number, number, number][] = [
  ...FILLERS.domed_hall.map((f) => [f.pos[0], f.pos[2], 15 * f.scale] as [number, number, number]),
  ...FILLERS.pavilion_small.map((f) => [f.pos[0], f.pos[2], 11 * f.scale] as [number, number, number]),
  ...FILLERS.minaret.map((f) => [f.pos[0], f.pos[2], 4] as [number, number, number]),
  [COMMUNITY_PLAZA.x, COMMUNITY_PLAZA.z, COMMUNITY_PLAZA.r + 1],
]

/** True inside the long pool (basin + channel) footprint, with curbs. */
export function inPool(x: number, z: number, margin = 0) {
  const { basin: b, channel: c, curbT } = POOL
  const m = margin + curbT
  if (Math.abs(x - POOL.x) < b.halfW + m && z > b.z0 - m && z < b.z1 + m) return true
  return Math.abs(x - POOL.x) < c.halfW + m && z > c.z0 - m && z < c.z1 + m
}

/** True where nothing is built, paved or wet (with a margin in metres). */
export function isFree(x: number, z: number, margin = 0) {
  const { promenadeInset: pi, promenadeWidth: pw } = ISLAND
  const d = inland(x, z)
  if (d < 2 + margin) return false // shore edge
  if (d > pi - margin && d < pi + pw + margin) return false // promenade follows the shore
  for (const [cx, cz, r] of [...FOOTPRINTS, ...EXTRA_FREE]) if ((x - cx) ** 2 + (z - cz) ** 2 < (r + margin) ** 2) return false
  for (const [x0, x1, z0, z1] of PAVED) if (x > x0 - margin && x < x1 + margin && z > z0 - margin && z < z1 + margin) return false
  if (Math.abs(x - CANAL.x) < CANAL.width / 2 + margin && z > CANAL.z0 - margin) return false
  if (inPool(x, z, margin)) return false
  if (inEntranceSightline(x, z)) return false // keep each entrance view clear
  return true
}
