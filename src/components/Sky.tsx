'use client'

import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Environment, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { HDRI_URL, SKY_BG_URL, envRotation } from '@/lib/sky'

/**
 * Lighting: 2k HDR (image-based lighting only, not visible).
 * Visible sky: the 4k pre-graded JPG of the same HDRI as scene.background, rotated identically.
 *
 * The JPG's lower half is dark ground; it used to show as a dark band/rectangle between the far
 * edge of the sea plane and the horizon (behind the skyline, worse as the camera rises). Fix, in
 * the texture itself (no extra geometry, nothing drawn over the scene): below the horizon the image
 * repeats the horizon haze row, so there is no dark ground left to show.
 */
/** degrees the sky image (and its sun) is lowered toward the horizon */
const SKY_LOWER_DEG = 2.5

function horizonFilled(img: HTMLImageElement) {
  const w = img.naturalWidth, h = img.naturalHeight
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  // lower the sun toward the horizon (video opening): the whole sky image moves down SKY_LOWER_DEG
  const D = Math.round((h * SKY_LOWER_DEG) / 180)
  g.drawImage(img, 0, D)
  g.drawImage(img, 0, 0, w, 1, 0, 0, w, D) // zenith row fills the top
  const row = Math.floor(h / 2) + D - 3 // just above the (shifted) horizon (equirect: v = 0.5 is the horizon)
  g.drawImage(c, 0, row, w, 1, 0, row + 1, w, h - row - 1) // stretch that (shifted) haze row down
  const t = new THREE.CanvasTexture(c)
  t.mapping = THREE.EquirectangularReflectionMapping
  t.colorSpace = THREE.SRGBColorSpace // sRGB => three skips tone mapping on it
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

export default function Sky() {
  const scene = useThree((s) => s.scene)
  const raw = useTexture(SKY_BG_URL)
  const bg = useMemo(() => horizonFilled(raw.image as HTMLImageElement), [raw])

  useEffect(() => {
    scene.background = bg
    scene.backgroundRotation.copy(envRotation)
    return () => {
      if (scene.background === bg) scene.background = null
    }
  }, [bg, scene])

  return <Environment files={HDRI_URL} environmentRotation={envRotation} />
}
