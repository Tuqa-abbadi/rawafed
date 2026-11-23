'use client'

import { useEffect, useMemo, useRef } from 'react'
import { store } from '@/lib/store'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { makeWaterNormals } from '@/lib/waterNormals'
import { SEA_Y } from '@/lib/layout'
import { LAYER_NO_REFLECT } from '@/lib/layers'

/**
 * Calm sunset sea (video t004): planar reflection of sky + skyline, mixed with a deep teal body
 * colour by Fresnel and distorted by two scrolling wave-normal layers. Unlit on purpose — real
 * water is almost all reflection; lighting it like a diffuse surface washed it out to cream.
 * The sparkling path under the sun is SunGlitter.
 */
const WaterShader = {
  name: 'RawafedWater',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    tNormal: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color('#5786b6') },
    uDeep: { value: new THREE.Color('#7ea4c9') },
    uReflect: { value: 0.55 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tNormal;
    uniform float uTime;
    uniform vec3 uShallow;
    uniform vec3 uDeep;
    uniform float uReflect;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vec2 p = vWorld.xz;
      // wind ripples: crests long along x, so they read as horizontal streaks (video t004)
      vec3 n1 = texture2D(tNormal, p * vec2(0.07, 0.19) + vec2(uTime * 0.012, uTime * 0.03)).rgb * 2.0 - 1.0;
      vec3 n2 = texture2D(tNormal, p * vec2(0.02, 0.05) - vec2(uTime * 0.006, -uTime * 0.014)).rgb * 2.0 - 1.0;
      vec2 slope = n1.xy * 0.7 + n2.xy * 0.8;
      vec3 N = normalize(vec3(slope.x * 0.3, 1.0, slope.y * 0.3));
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);

      float dist = length(cameraPosition.xz - vWorld.xz);
      // far ripples are sub-pixel (the normal map mips to flat), yet real distant water smears
      // reflections into soft vertical columns (t004): blur the reflection vertically with distance
      vec2 base = vUv.xy / vUv.w + vec2(slope.x * 0.006, slope.y * 0.012);
      float far = smoothstep(10.0, 350.0, dist);
      float smear = 0.006 + 0.11 * far;
      // thin horizontal ripple bands shift the reflection sideways -> broken, shimmering columns
      float band = base.y * 700.0;
      float wob = sin(band + uTime * 2.6) * 0.6 + sin(band * 0.43 - uTime * 1.9) * 0.4;
      base.x += wob * 0.006 * far;
      vec3 refl = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float o = (float(i) / 7.0 - 0.3) * smear; // mostly toward the viewer, like a real smear
        refl += texture2D(tDiffuse, base + vec2(0.0, o)).rgb;
      }
      refl /= 8.0;
      // ripples tilt toward the higher, bluer sky: cool the reflected horizon glow
      refl *= vec3(0.8, 0.9, 1.04);

      vec3 body = mix(uShallow, uDeep, smoothstep(8.0, 260.0, dist));
      // bright ripple facets catching the sky
      body *= 0.92 + 0.22 * clamp(slope.y * 0.5 + 0.5, 0.0, 1.0);
      // the blue body stays visible up to the horizon (t004); reflections are a soft overlay
      vec3 col = mix(body, refl, clamp(fres * uReflect + 0.08, 0.0, 0.32));
      gl_FragColor = vec4(col, 1.0);
    }`,
}

export default function Water({ lite = false }: { lite?: boolean }) {
  const normals = useMemo(() => makeWaterNormals(256), [])
  const water = useMemo(() => {
    const w = new Reflector(new THREE.PlaneGeometry(4000, 4000), {
      textureWidth: lite ? 512 : 1024,
      textureHeight: lite ? 256 : 512,
      clipBias: 0.003,
      shader: WaterShader,
    })
    const mat = w.material as THREE.ShaderMaterial
    mat.uniforms.tNormal.value = normals
    w.rotation.x = -Math.PI / 2
    w.position.set(0, SEA_Y, -400) // guarded sea level (layout.ts): always below the island
    return w
  }, [lite, normals])

  // main camera sees the no-reflect layer, the reflection camera does not (palms, shrubs, paths)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.layers.enable(LAYER_NO_REFLECT)
    const rc = (water as unknown as { getReflectionCamera: (c: THREE.Camera) => THREE.Camera }).getReflectionCamera(camera)
    rc.layers.disable(LAYER_NO_REFLECT)
  }, [camera, water])

  useEffect(() => () => {
    water.getRenderTarget().dispose()
    ;(water.material as THREE.Material).dispose()
  }, [water])

  // The reflection re-renders the whole scene: full rate + full size only at eye level in the hero
  // (where it is seen up close). From the air (map) and inside the rooms it is refreshed every 2nd /
  // 3rd frame at half size — the water moves slowly, the difference is invisible, the GPU saving is large.
  useEffect(() => {
    const render = water.onBeforeRender.bind(water)
    let frame = 0
    water.onBeforeRender = (...args: Parameters<typeof water.onBeforeRender>) => {
      frame++
      const { phase, view } = store.get()
      const every = phase === 'hero' || phase === 'loading' ? 1 : view === 'interior' ? 3 : 2
      if (frame % every === 0) render(...args)
    }
    return () => {
      water.onBeforeRender = render
    }
  }, [water])
  const fullSize = useRef(true)
  useFrame((_, dt) => {
    ;(water.material as THREE.ShaderMaterial).uniforms.uTime.value += dt
    const hero = store.get().phase === 'hero' || store.get().phase === 'loading'
    if (hero !== fullSize.current) {
      fullSize.current = hero
      const w = lite ? 512 : 1024, h = lite ? 256 : 512
      water.getRenderTarget().setSize(hero ? w : w / 2, hero ? h : h / 2)
    }
  })

  return <primitive object={water} />
}
