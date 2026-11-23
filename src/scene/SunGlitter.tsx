'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HERO } from '@/lib/layout'
import { sunDirection } from '@/lib/sky'

/**
 * The column of sparkling light on the water under the low sun (video t004). A long strip on the
 * water surface from near the shore to the horizon along the sun's azimuth, additive, with
 * animated sparkle; it narrows toward the horizon like a real glitter path.
 */
export default function SunGlitter() {
  const az = Math.atan2(sunDirection.x, -sunDirection.z) // bearing from -Z toward +X
  const length = 900
  const width = 120 // must cover ~2 x 0.055 x the far distance
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true, // 2 cm above the water z-fights at 500 m: always win against the water
        polygonOffsetFactor: -8,
        polygonOffsetUnits: -8,
        blending: THREE.AdditiveBlending,
        fog: false,
        uniforms: {
          uTime: { value: 0 },
          uFade: { value: 1 },
          uColor: { value: new THREE.Color('#ffcf8a') },
          // distance from the camera to where the water starts along the sun bearing (past the sea wall)
          uStart: { value: Math.abs(HERO.terraceFrontZ - 1 - HERO.camEnd.z) / Math.cos(Math.atan2(sunDirection.x, -sunDirection.z)) },
          uLength: { value: length },
          uWidth: { value: width },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform float uFade; uniform vec3 uColor; uniform float uStart; uniform float uLength; uniform float uWidth; varying vec2 vUv;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
          }
          void main() {
            // vUv.y: 0 near shore -> 1 at horizon; vUv.x: across the path
            float far = vUv.y;
            // constant ANGULAR width like a real glitter path: physical half-width grows with distance
            // (t004: ~2° each side). Strip is uWidth metres wide, uLength long, starts uStart from the camera.
            float dist = uStart + far * uLength;
            float halfW = (0.04 * dist) / uWidth;
            float across = (vUv.x - 0.5) / halfW;          // -1..1 inside the path
            float core = exp(-across * across * 2.2);
            // horizontal streaks: wide across, thin along; spacing ~constant on screen (pow)
            vec2 p = vec2(across * 2.2, pow(far, 0.45) * 520.0);
            float n1 = noise(p + vec2(uTime * 0.35, -uTime * 2.2));
            float n2 = noise(p * vec2(2.3, 1.7) - vec2(uTime * 0.6, uTime * 1.3));
            float sp = smoothstep(0.35, 0.85, n1 * 0.6 + n2 * 0.5);
            // a continuous warm column (t004) broken into shimmering streaks; brightest near the horizon
            float body = mix(0.7, 1.0, smoothstep(0.0, 0.8, far));
            float bright = core * (body + 1.6 * sp) * smoothstep(uStart, uStart + 1.5, dist) * 5.0;
            gl_FragColor = vec4(uColor * bright * uFade, 1.0);
          }`,
      }),
    [],
  )
  const mesh = useRef<THREE.Mesh>(null)
  useFrame(({ camera }, dt) => {
    material.uniforms.uTime.value += dt
    // a glitter path only exists for an eye near the water: hide it once the camera climbs
    // the path is laid out for the eye at the gateway: hide it once the camera has moved away
    // fades (no pop) as the camera comes down to eye level in the opening intro / leaves it
    const fade = THREE.MathUtils.smoothstep(camera.position.y, 3, 9.5) // 1 above 9.5 m
    material.uniforms.uFade.value = 1 - fade
    if (mesh.current) mesh.current.visible = fade < 0.999 && camera.position.x > -2.5
  })
  // strip origin just beyond the sea wall, pointing toward the sun
  // the path lies on the line from the viewer toward the sun (a vertical column under the sun on screen)
  const dir = new THREE.Vector3(Math.sin(az), 0, -Math.cos(az))
  const startDist = material.uniforms.uStart.value as number
  const start = new THREE.Vector3(HERO.camEnd.x, HERO.waterY + 0.12, HERO.camEnd.z).addScaledVector(dir, startDist)
  const center = start.clone().addScaledVector(dir, length / 2)
  return (
    // inner: lay the plane flat (its +Y length axis -> -Z); outer: turn toward the sun's bearing
    <group position={center} rotation-y={-az}>
      <mesh ref={mesh} rotation-x={-Math.PI / 2} material={material} renderOrder={2}>
        <planeGeometry args={[width, length]} />
      </mesh>
    </group>
  )
}
