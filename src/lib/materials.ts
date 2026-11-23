import * as THREE from 'three'

/** Warm the (white-ish) Meshy stone toward the video's ivory/peach stone. */
export function tintScene(root: THREE.Object3D, color: THREE.ColorRepresentation, opts: { shadows?: boolean } = {}) {
  const c = new THREE.Color(color)
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    if (opts.shadows !== false) {
      m.castShadow = true
      m.receiveShadow = true
    }
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial
      if (std.color) std.color.copy(c)
    }
  })
}

/**
 * Make gold areas of a texture glow (mashrabiya lattice, arch fills): emissive = baseColor x a
 * saturation mask, so white stone stays non-emissive. Patched once per material.
 */
export function addGoldGlow(root: THREE.Object3D, intensity = 0.6, tint: THREE.ColorRepresentation = '#EBC57A') {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    for (const mat of mats) goldGlowMaterial(mat as THREE.MeshStandardMaterial, intensity, tint)
  })
}

/**
 * Patch one material (once). `userData.glowUniform` exposes the intensity so it can be animated
 * (hover highlight on the map); `userData.highlight` is an extra uniform for a whole-surface gold lift.
 */
export function goldGlowMaterial(std: THREE.MeshStandardMaterial, intensity = 0.6, tint: THREE.ColorRepresentation = '#EBC57A') {
  if (std.userData.goldGlow) return std
  std.userData.goldGlow = true
  const uGlow = { value: intensity }
  const uHighlight = { value: 0 }
  std.userData.glowUniform = uGlow
  std.userData.highlight = uHighlight
  const t = new THREE.Color(tint)
  std.onBeforeCompile = (shader) => {
    shader.uniforms.uGoldGlow = uGlow
    shader.uniforms.uHighlight = uHighlight
    shader.uniforms.uGoldTint = { value: t }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGoldGlow;\nuniform float uHighlight;\nuniform vec3 uGoldTint;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 bc = diffuseColor.rgb;
          float mx = max(bc.r, max(bc.g, bc.b));
          float mn = min(bc.r, min(bc.g, bc.b));
          float sat = (mx - mn) / max(mx, 1e-4);
          // gold: saturated, warm (r > b), not too dark
          float gold = smoothstep(0.32, 0.55, sat) * step(bc.b, bc.r) * smoothstep(0.08, 0.25, mx);
          totalEmissiveRadiance += bc * uGoldTint * gold * uGoldGlow;
          // hover: warm gold lift over the whole building
          totalEmissiveRadiance += uGoldTint * bc * uHighlight * (0.6 + gold);
        }`,
      )
  }
  std.needsUpdate = true
  return std
}

/**
 * A GLTF scene's single mesh plus its world matrix. The matrix is NOT baked into the geometry:
 * meshopt/quantized models store positions as normalized int16 with the dequantization scale on
 * the node, and baking would clamp them to [-1, 1]. Multiply `matrix` into instance transforms.
 */
export function firstMesh(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  let found: THREE.Mesh | null = null
  root.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh
  })
  if (!found) throw new Error('no mesh')
  const mesh = found as THREE.Mesh
  // relative to the GLTF root: the same scene may also be placed somewhere (e.g. the hero olive),
  // and that placement must not leak into the instances
  const matrix = root.matrixWorld.clone().invert().multiply(mesh.matrixWorld)
  return { geometry: mesh.geometry, material: mesh.material as THREE.MeshStandardMaterial, matrix }
}
