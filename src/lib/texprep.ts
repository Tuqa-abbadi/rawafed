import * as THREE from 'three'

/** phones / small touch screens: GPU memory is tight */
export const IS_PHONE = typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820)
const PHONE_MAX = 1024

/**
 * Prepare a texture BEFORE its first GPU upload (never re-uploads): max anisotropy, and on phones
 * images larger than 1024 px are scaled down (4x less GPU memory per 2k texture). Already-uploaded
 * textures (version > 0) are left alone.
 */
export function prepTexture(t: THREE.Texture, maxAniso: number) {
  if (t.version > 0 || t.userData.prepped) return
  t.userData.prepped = true
  t.anisotropy = IS_PHONE ? Math.min(4, maxAniso) : maxAniso
  if (!IS_PHONE) return
  const img = t.image as { width?: number; height?: number } | undefined
  if (!img || !img.width || !img.height || Math.max(img.width, img.height) <= PHONE_MAX) return
  if ((t as THREE.DataTexture).isDataTexture || (t as THREE.CompressedTexture).isCompressedTexture) return
  const k = PHONE_MAX / Math.max(img.width, img.height)
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.width * k))
  c.height = Math.max(1, Math.round(img.height * k))
  try {
    c.getContext('2d')!.drawImage(img as CanvasImageSource, 0, 0, c.width, c.height)
    t.image = c
    t.needsUpdate = true
  } catch {
    /* keep the original */
  }
}
