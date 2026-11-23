import * as THREE from 'three'

/**
 * Procedural, tileable water normal map (no extra asset): sum of a few wrapped sine-wave
 * octaves in random directions -> height field -> normals. Calm sea at sunset (video t004).
 */
export function makeWaterNormals(size = 256, seed = 3) {
  let s = seed
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const waves = Array.from({ length: 14 }, (_, i) => {
    // integer wave numbers keep the texture tileable
    const kx = Math.round((rand() * 2 - 1) * (2 + i * 1.6))
    const ky = Math.round((rand() * 2 - 1) * (2 + i * 1.6)) || 1
    return { kx, ky, amp: 1 / (1 + i * 0.7), phase: rand() * Math.PI * 2 }
  })
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let v = 0
      for (const w of waves) v += w.amp * Math.sin(((w.kx * x + w.ky * y) / size) * Math.PI * 2 + w.phase)
      h[y * size + x] = v
    }
  const data = new Uint8Array(size * size * 4)
  const strength = 2.2
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const at = (xx: number, yy: number) => h[((yy + size) % size) * size + ((xx + size) % size)]
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const n = new THREE.Vector3(-dx, -dy, 8).normalize()
      const i = (y * size + x) * 4
      data[i] = (n.x * 0.5 + 0.5) * 255
      data[i + 1] = (n.y * 0.5 + 0.5) * 255
      data[i + 2] = (n.z * 0.5 + 0.5) * 255
      data[i + 3] = 255
    }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}
