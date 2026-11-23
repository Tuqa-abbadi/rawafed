import * as THREE from 'three'

/**
 * Flat ground shapes. THREE.Shape lives in XY; we lay it on the ground with rotateX(-PI/2), which
 * maps shape (x, y) to world (x, 0, -y). So these helpers take WORLD x/z and store y = -z.
 */
export function roundedRect(minX: number, maxX: number, minZ: number, maxZ: number, r: number, path: THREE.Path = new THREE.Shape()) {
  const y0 = -maxZ, y1 = -minZ // shape y range
  path.moveTo(minX + r, y0)
  path.lineTo(maxX - r, y0)
  path.quadraticCurveTo(maxX, y0, maxX, y0 + r)
  path.lineTo(maxX, y1 - r)
  path.quadraticCurveTo(maxX, y1, maxX - r, y1)
  path.lineTo(minX + r, y1)
  path.quadraticCurveTo(minX, y1, minX, y1 - r)
  path.lineTo(minX, y0 + r)
  path.quadraticCurveTo(minX, y0, minX + r, y0)
  return path
}

/** Flat geometry at height y from a shape, UVs in metres (x, z). */
export function flat(shape: THREE.Shape | THREE.Shape[], y = 0, segments = 12) {
  const g = new THREE.ShapeGeometry(shape, segments)
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

/** Axis-aligned flat rectangle (x0..x1, z0..z1) as a shape. */
export function rect(x0: number, x1: number, z0: number, z1: number) {
  const s = new THREE.Shape()
  s.moveTo(x0, -z0)
  s.lineTo(x1, -z0)
  s.lineTo(x1, -z1)
  s.lineTo(x0, -z1)
  s.closePath()
  return s
}

/** Circle shape centred at world (x, z). */
export function circle(x: number, z: number, r: number) {
  const s = new THREE.Shape()
  s.absarc(x, -z, r, 0, Math.PI * 2, false)
  return s
}

export function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** Tile a texture set in metres (repeat = 1 / tile) — geometry UVs are already in metres. */
export function tiled(textures: THREE.Texture[], tile: number, srgbFirst = true) {
  return textures.map((t, i) => {
    const c = t.clone()
    c.wrapS = c.wrapT = THREE.RepeatWrapping
    c.repeat.set(1 / tile, 1 / tile)
    c.anisotropy = 8
    if (i === 0 && srgbFirst) c.colorSpace = THREE.SRGBColorSpace
    c.needsUpdate = true
    return c
  })
}
