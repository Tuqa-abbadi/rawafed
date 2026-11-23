import * as THREE from 'three'

/**
 * Smooth ivory limestone with faint block joints (video t004 pillars: pale, almost plain stone,
 * joints barely visible). One texture tile = 1 m wide x 1.5 m tall (one block course).
 */
export function makeStoneTexture() {
  const w = 256, h = 384
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, w, h)
  // soft mottling so large faces don't look like flat plastic
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 4 + Math.random() * 22
    g.fillStyle = `rgba(${200 + Math.random() * 40},${180 + Math.random() * 40},${150 + Math.random() * 40},0.035)`
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  // horizontal joint at the top of the course, offset vertical joint
  g.fillStyle = 'rgba(150,120,85,0.28)'
  g.fillRect(0, 0, w, 2)
  g.fillRect(w * 0.62, 0, 2, h)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/**
 * Gold mashrabiya lattice with 8-point stars (video t002 frame edges). Back-lit look: warm bars,
 * amber glow in the openings. One tile = one star. Returns colour + alpha maps.
 */
export function makeMashrabiyaTexture(tiles = 1) {
  const S = 256
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!
  // openings: bright warm light from the low sun behind the screen (t002)
  g.fillStyle = '#ffd18a'
  g.fillRect(0, 0, S, S)

  // bars: dark bronze-gold wood/metal, lit from the edges
  g.strokeStyle = '#8a5a26'
  g.lineCap = 'square'
  g.lineJoin = 'miter'
  g.lineWidth = S * 0.075
  const cx = S / 2, cy = S / 2, r = S * 0.34
  // 8-point star = two squares, one turned 45 degrees
  for (const rot of [0, Math.PI / 4]) {
    g.beginPath()
    for (let k = 0; k < 4; k++) {
      const a = rot + Math.PI / 4 + (k * Math.PI) / 2
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
      if (k === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.closePath()
    g.stroke()
  }
  // small octagon in the centre
  g.beginPath()
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4
    const x = cx + Math.cos(a) * r * 0.42, y = cy + Math.sin(a) * r * 0.42
    if (k === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.closePath()
  g.stroke()
  // links to the neighbouring stars (edges) and the corner rosettes (diagonals)
  g.beginPath()
  const e = r * 0.92
  g.moveTo(cx, 0); g.lineTo(cx, cy - e)
  g.moveTo(cx, S); g.lineTo(cx, cy + e)
  g.moveTo(0, cy); g.lineTo(cx - e, cy)
  g.moveTo(S, cy); g.lineTo(cx + e, cy)
  const d = r * 0.68
  g.moveTo(0, 0); g.lineTo(cx - d, cy - d)
  g.moveTo(S, 0); g.lineTo(cx + d, cy - d)
  g.moveTo(0, S); g.lineTo(cx - d, cy + d)
  g.moveTo(S, S); g.lineTo(cx + d, cy + d)
  g.stroke()
  // tile border (shared frame between stars)
  g.lineWidth = S * 0.06
  g.strokeRect(0, 0, S, S)

  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(tiles, tiles)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** Pillar-to-pillar wall with a pointed (two-centred) arch opening, as an extruded outline. */
export function makePointedArchWall(half: number, sideW: number, spring: number, rise: number, top: number, depth: number) {
  // left arc centred right of the axis, right arc mirrored; both meet at the apex (0, spring + rise)
  const cx = (rise * rise - half * half) / (2 * half)
  const R = half + cx
  const apexAng = Math.acos(-cx / R)
  const s = new THREE.Shape()
  s.moveTo(-half - sideW, spring)
  s.lineTo(-half, spring)
  s.absarc(cx, spring, R, Math.PI, apexAng, true)
  s.absarc(-cx, spring, R, Math.PI - apexAng, 0, true)
  s.lineTo(half + sideW, spring)
  s.lineTo(half + sideW, top)
  s.lineTo(-half - sideW, top)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 24 })
  // UVs in metres so the stone texture tiles like on the pillars (1 m x 1.5 m courses)
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i) / 1.5)
  return geo
}
