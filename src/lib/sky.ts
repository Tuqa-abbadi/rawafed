import * as THREE from 'three'

/** HDRI: Poly Haven "Qwantani Sunset (Pure Sky)", 2k. See CREDITS.md. */
export const HDRI_URL = '/env/sunset_1k.hdr' // 1k is plenty for lighting (first view: 1 MB instead of 4.2)
/** Visible background: Poly Haven's pre-graded (tonemapped) JPG of the same HDRI, downscaled to 4096x2048. */
export const SKY_BG_URL = '/env/sky_4k.jpg'

/**
 * Sun as measured in the HDRI (scripts/hdri_sun.py): u = 0.600, elevation 6.06 deg.
 * three.js equirect mapping: u = atan2(dir.z, dir.x) / 2PI + 0.5, so the sun's
 * azimuth atan2(z, x) in the raw HDRI is (0.600 - 0.5) * 360 = 36 deg.
 * We rotate the environment around Y so the sun sits just right of the -Z axis
 * (the direction the hero camera looks toward the sea and skyline).
 */
const SUN_ELEV = THREE.MathUtils.degToRad(6.06)
const SUN_AZ_IN_HDRI = THREE.MathUtils.degToRad(36)
// Matches the video hero (refs/video_frames/t006s.jpg): sun ~22.5 deg left of the view axis (-Z),
// i.e. 25% from the left edge of a 16:9 frame at fov 50.
const SUN_AZ_WANTED = THREE.MathUtils.degToRad(-112.5)

export const ENV_ROT_Y = SUN_AZ_IN_HDRI - SUN_AZ_WANTED
export const envRotation = new THREE.Euler(0, ENV_ROT_Y, 0)

/**
 * Unit vector toward the sun as it actually RENDERS in the visible sky JPG (sun disc, glitter path,
 * sun light). Measured on screen in the hero (screens/compare/stage3_hero_v14): the JPG's visual
 * sun centre sits ~4.1° right of and ~1.5° below the HDR's brightest pixel used for ENV_ROT_Y.
 */
const SUN_AZ_VISIBLE = SUN_AZ_WANTED + THREE.MathUtils.degToRad(4.1)
const SUN_ELEV_VISIBLE = SUN_ELEV - THREE.MathUtils.degToRad(1.5)
export const sunDirection = new THREE.Vector3(
  Math.cos(SUN_ELEV_VISIBLE) * Math.cos(SUN_AZ_VISIBLE),
  Math.sin(SUN_ELEV_VISIBLE),
  Math.cos(SUN_ELEV_VISIBLE) * Math.sin(SUN_AZ_VISIBLE),
)
