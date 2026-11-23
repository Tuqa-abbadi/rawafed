'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import ModelInstances, { type Inst } from '../map/ModelInstances'
import { tiled } from '../map/shapes'
import { RECITERS, player, recitation, useRecitation, type ReciterId } from '@/lib/recitation'
import { store } from '@/lib/store'
import { useLang } from '@/lib/i18n'

const m = (n: string) => `/models/${n}.glb`
const RECITER_POS = new THREE.Vector3(0, 0.14, -3) // on the dais, facing the visitor (+Z)

/**
 * The reciters hall (CLAUDE.md "Reciters hall", video t102–t164): a row of carved arches behind
 * the reciter opening onto the sea and the skyline, a red rug on a low dais, lanterns, a warm
 * coffered ceiling. Placed on the water west of the island (out of every other view); entered
 * through the القرّاء doors by the same straight-in flight + warm fade as the other buildings.
 */
export default function ReciterHall() {
  useLang() // name tags follow the UI language
  // one Quran only: each reciter's model already holds his rehal + mushaf (no separate prop)
  const floor = useMarbleFloor()
  const rug = useRugTexture()
  const arches = useMemo<Inst[]>(() => {
    const out: Inst[] = []
    for (const x of [-9.7, 0, 9.7]) out.push({ pos: [x, 0, -8], rotY: 0, scale: 1 }) // behind the reciter: sea view
    for (const s of [-1, 1]) for (const z of [-3, 6.7]) out.push({ pos: [s * 14.5, 0, z], rotY: (s * Math.PI) / 2, scale: 1 })
    return out
  }, [])
  const lanterns = useMemo<Inst[]>(
    () => [[-3.2, -1.6], [3.2, -1.6], [-4.6, 2.4], [4.6, 2.4], [-6.4, -5.6], [6.4, -5.6]].map(([x, z]) => ({ pos: [x, 0, z], rotY: x, scale: 1.25 })),
    [],
  )
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} material={floor} receiveShadow>
        <planeGeometry args={[30, 20]} />
      </mesh>
      <mesh position={[0, -1.2, 0]}>
        <boxGeometry args={[30.2, 2.4, 20.2]} />
        <meshStandardMaterial color="#e6d6bd" roughness={0.7} />
      </mesh>
      {/* warm coffered ceiling */}
      <mesh position={[0, 8.05, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[30, 20]} />
        <meshStandardMaterial color="#7a5434" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[(i - 3) * 4.2, 7.85, 0]}>
          <boxGeometry args={[0.35, 0.3, 20]} />
          <meshStandardMaterial color="#c9963f" metalness={0.6} roughness={0.4} emissive="#4a2c0e" emissiveIntensity={0.4} />
        </mesh>
      ))}
      <ModelInstances
        url={m('hall_arch_wall')}
        list={arches}
        prepare={(mt) => {
          mt.color.set('#F3E7D5')
          mt.side = THREE.DoubleSide
        }}
      />
      {/* low dais + red rug */}
      <mesh position={[0, 0.07, -2.6]}>
        <cylinderGeometry args={[2.3, 2.4, 0.14, 64]} />
        <meshStandardMaterial color="#efe2cc" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.145, -2.6]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[3.4, 2.4]} />
        <meshStandardMaterial map={rug} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.012, 2.6]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2.2, 7.5]} />
        <meshStandardMaterial map={rug} roughness={0.95} />
      </mesh>
      <ModelInstances
        url={m('lantern_hi')}
        list={lanterns}
        shadows={false}
        prepare={(mt) => {
          mt.side = THREE.DoubleSide
          mt.emissive.set('#ffb35c')
          mt.emissiveIntensity = 0.32 // subtle lantern glow (no bloom hot spots)
        }}
      />
      {RECITERS.map((r) => (
        <Reciter key={r.id} id={r.id} model={r.model} name={r.name} />
      ))}
    </group>
  )
}

function useMarbleFloor() {
  const tex = useTexture(['/textures/marble_01_diff.webp', '/textures/marble_01_nor_gl.webp', '/textures/marble_01_arm.webp'])
  return useMemo(() => {
    const [map, normalMap, arm] = tiled(tex, 3)
    return new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap: arm, color: '#f6ead8', roughness: 0.35 })
  }, [tex])
}

/** Deep red rug with a gold border and a central medallion (canvas texture). */
function useRugTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 512
    const g = c.getContext('2d')!
    g.fillStyle = '#7a1418'
    g.fillRect(0, 0, 512, 512)
    g.strokeStyle = '#c9963f'
    g.lineWidth = 18
    g.strokeRect(20, 20, 472, 472)
    g.lineWidth = 4
    g.strokeRect(46, 46, 420, 420)
    g.fillStyle = '#9c2026'
    g.beginPath()
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, r = k % 2 ? 90 : 150
      const x = 256 + Math.cos(a) * r, y = 256 + Math.sin(a) * r
      if (k === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.closePath()
    g.fill()
    g.strokeStyle = '#e0b866'
    g.lineWidth = 5
    g.stroke()
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${40 + Math.random() * 60},0,0,0.08)`
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
}

/**
 * A seated reciter animated in code (the Meshy model is a static mesh): a vertex shader nods and
 * turns the head about the neck, opens the jaw with the recitation loudness and swells the chest
 * with the breath. Head/neck/face are found from the geometry once. Crossfades with the other one.
 */
function Reciter({ id, model, name }: { id: ReciterId; model: string; name: string }) {
  const { scene } = useGLTF(m(model))
  const obj = useMemo(() => scene.clone(true), [scene])
  const uniforms = useMemo(
    () => ({ uNod: { value: 0 }, uTurn: { value: 0 }, uJaw: { value: 0 }, uBreath: { value: 0 }, uNeck: { value: new THREE.Vector4() }, uFace: { value: new THREE.Vector4() } }),
    [],
  )
  useLayoutEffect(() => {
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.frustumCulled = false
      // head landmarks in the mesh's LOCAL (quantized) space: top of the head, neck, face front
      const pos = mesh.geometry.attributes.position as THREE.BufferAttribute
      mesh.geometry.computeBoundingBox()
      const bb = mesh.geometry.boundingBox!
      const S = (bb.max.y - bb.min.y) / 1.0 // local units per metre (model is 1.0 m tall)
      const neckY = bb.max.y - 0.25 * S
      let cx = 0, cz = 0, n = 0, faceZ = -Infinity
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) < neckY + 0.04 * S) continue
        cx += pos.getX(i)
        cz += pos.getZ(i)
        n++
        faceZ = Math.max(faceZ, pos.getZ(i))
      }
      cx /= Math.max(1, n)
      cz /= Math.max(1, n)
      uniforms.uNeck.value.set(cx, neckY, cz, S)
      uniforms.uFace.value.set(bb.max.y - 0.15 * S, faceZ, 0, 0) // mouth height, face front z

      const mt = (mesh.material as THREE.MeshStandardMaterial).clone()
      // opaque (the switch is a soft dip, not a transparent overlap: no sorting pops); matte so
      // the white thobe / shemagh never blow out
      mt.transparent = false
      mt.side = THREE.DoubleSide
      // natural, even look (no muddy darks, no blown whites): the baked colour map lifts itself a
      // little through the emissive channel (keeps skin tone, white thobe, black bisht + gold trim)
      const lift = id === 'old' ? 0.3 : 0.14
      mt.envMapIntensity = 0.55
      if (!mt.roughnessMap) mt.roughness = Math.max(mt.roughness, 0.75)
      mt.color.setScalar(id === 'old' ? 1.12 : 0.95)
      if (mt.map) {
        mt.emissiveMap = mt.map
        mt.emissive.set('#fff1e0')
        mt.emissiveIntensity = lift
      }
      if (mt.metalnessMap || mt.metalness > 0.05) mt.metalness = Math.min(mt.metalness, 0.6) // gold trim keeps its sheen
      mt.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms)
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uNod, uTurn, uJaw, uBreath; uniform vec4 uNeck; uniform vec4 uFace;')
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            {
              float S = uNeck.w;
              vec3 piv = uNeck.xyz;
              vec3 p = transformed;
              // jaw: lower face, front of the head, below the mouth line
              float jw = smoothstep(uFace.x + 0.015 * S, uFace.x - 0.02 * S, p.y)
                       * smoothstep(piv.y + 0.02 * S, piv.y + 0.06 * S, p.y)
                       * smoothstep(uFace.y - 0.09 * S, uFace.y - 0.03 * S, p.z);
              p.y -= jw * uJaw * 0.014 * S;
              // head: nod (x) + turn (y) about the neck, blended in over the neck
              float hw = smoothstep(piv.y - 0.03 * S, piv.y + 0.04 * S, p.y);
              vec3 q = p - piv;
              float cn = cos(uNod), sn = sin(uNod), ct = cos(uTurn), st = sin(uTurn);
              q = vec3(q.x, cn * q.y - sn * q.z, sn * q.y + cn * q.z);
              q = vec3(ct * q.x + st * q.z, q.y, -st * q.x + ct * q.z);
              p = mix(p, q + piv, hw);
              // breathing: chest and shoulders swell a little
              float cw = smoothstep(piv.y - 0.38 * S, piv.y - 0.2 * S, p.y) * (1.0 - hw);
              p.xz += (p.xz - piv.xz) * cw * uBreath;
              p.y += cw * uBreath * 0.25 * S * 0.04;
              transformed = p;
            }`,
          )
      }
      mt.needsUpdate = true
      mesh.material = mt
    })
  }, [obj, uniforms])

  // compile both reciters at hall load (the hidden one too), so a switch never compiles/loads
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const world = useThree((s) => s.scene)
  useLayoutEffect(() => {
    const was = obj.visible
    obj.visible = true
    try {
      gl.compile(obj, camera, world)
    } catch {
      /* best effort */
    }
    obj.visible = was
  }, [gl, camera, world, obj])

  const jaw = useRef(0)
  const group = useRef<THREE.Group>(null)
  const label = useRef<HTMLDivElement>(null)
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const active = recitation.get().reciter === id
    const inside = store.get().view === 'interior' && store.get().rafid === 'reciters'
    // instant swap, hidden by the hall's soft dip (recitation.ts switchReciter)
    obj.visible = active
    if (label.current) label.current.style.opacity = String(inside && active ? 1 : 0)
    if (!active || !inside) return
    const lvl = player.level()
    jaw.current += (lvl - jaw.current) * Math.min(1, dt * 18)
    const playing = recitation.get().playing
    uniforms.uJaw.value = jaw.current
    uniforms.uNod.value = Math.sin(t * 0.85) * (playing ? 0.05 : 0.018) + jaw.current * 0.04
    uniforms.uTurn.value = Math.sin(t * 0.31) * 0.06
    uniforms.uBreath.value = (Math.sin(t * (playing ? 1.1 : 1.5)) * 0.5 + 0.5) * 0.018
    // the gentle forward sway of recitation
    if (group.current) group.current.rotation.x = playing ? Math.sin(t * 0.85) * 0.018 : 0
  })

  return (
    <group ref={group} position={RECITER_POS}>
      <primitive object={obj} />
      <Html position={[0, 1.28, 0]} center zIndexRange={[12, 10]} style={{ pointerEvents: 'none' }}>
        <div ref={label} className="reciter-tag glass is-pill" style={{ opacity: 0 }}>
          {name}
        </div>
      </Html>
    </group>
  )
}
