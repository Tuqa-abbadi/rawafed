'use client'

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Stagger from '../Stagger'
import { IS_PHONE, prepTexture } from '@/lib/texprep'
import type { RafidKey } from '@/lib/store'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { store, useStore } from '@/lib/store'
import { INTERIOR_ORIGIN } from '@/lib/views'
import { prefetchAudio } from '@/lib/recitation'
import { setNoReflect } from '@/lib/layers'
import { tintScene } from '@/lib/materials'
import ModelInstances, { type Inst } from '../map/ModelInstances'
import { tiled } from '../map/shapes'
import { makeMashrabiyaTexture, makePointedArchWall } from '../hero/portalTextures'
import ReciterHall from './ReciterHall'

const m = (n: string) => `/models/${n}.glb`
/** Interior furniture is seen up close: double-sided so inward-wound Meshy faces never show black. */
const ds = (mt: THREE.MeshStandardMaterial) => {
  mt.side = THREE.DoubleSide
}

/**
 * Small interior vignettes (CLAUDE.md "Map + predefined transitions"): reached from a building's
 * entrance through a warm fade. They sit far behind the map camera, out of every other view.
 */
export default function Interiors() {
  const phoneRoom = useStore((s) => (IS_PHONE && s.phase === 'building' ? s.rafid : null))
  if (IS_PHONE) return phoneRoom ? <PhoneRoom key={phoneRoom} id={phoneRoom} /> : null
  return <AllRooms />
}

/**
 * Phones (tight memory, iOS closes the tab): only the room being visited exists — it loads during
 * the flight to the door, and is released when you leave (the flight waits behind the dark fade).
 */
function PhoneRoom({ id }: { id: RafidKey }) {
  const root = useRef<THREE.Group>(null)
  const room =
    id === 'reciters' ? <ReciterHall /> : id === 'library' ? <LibraryHall /> : id === 'learning' ? <Classroom /> : <Majlis />
  return (
    <group ref={root}>
      <InteriorLight />
      <Suspense fallback={null}>
        <group position={INTERIOR_ORIGIN[id]}>{room}</group>
        <Ready root={root} />
      </Suspense>
    </group>
  )
}

function AllRooms() {
  // built in the background once their textures are on the GPU (Warmups), one room at a time; they
  // stand far off-screen, so nothing is drawn until a visit (or at the latest on reaching the map)
  const onMap = useStore((s) => s.mapReady && (s.roomsWarm || (s.phase !== 'hero' && s.phase !== 'loading')))
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (onMap) setMounted(true) // stays mounted afterwards (going home keeps the rooms ready)
  }, [onMap])
  if (!mounted) return null
  return <Sets />
}

/**
 * Loaded -> warm up: compile every shader and upload every texture of the sets in the background,
 * so the cut into a room never shows a half-drawn first frame (nav waits for interiorsWarm).
 */
function Ready({ root }: { root: React.RefObject<THREE.Group | null> }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    if (root.current) setNoReflect(root.current) // all rooms are mounted by now (Stagger: Ready is last)
    store.set({ interiorsReady: true })
    prefetchAudio() // the hall's recitations, in the background
    let done = false
    const warm = async () => {
      try {
        const seen = new Set<THREE.Texture>()
        scene.traverse((o) => {
          const mats = (o as THREE.Mesh).material
          for (const mt of Array.isArray(mats) ? mats : mats ? [mats] : [])
            for (const v of Object.values(mt as unknown as Record<string, unknown>))
              if (v instanceof THREE.Texture && !seen.has(v)) {
                seen.add(v)
                prepTexture(v, gl.capabilities.getMaxAnisotropy())
                gl.initTexture(v)
              }
        })
        await gl.compileAsync(scene, camera)
      } catch {
        /* warm-up is best effort */
      }
      if (!done) store.set({ interiorsWarm: true })
    }
    void warm()
    return () => {
      done = true
      if (IS_PHONE) store.set({ interiorsReady: false, interiorsWarm: false }) // the room is released
    }
  }, [gl, scene, camera])
  return null
}

function Sets() {
  const root = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    if (root.current) setNoReflect(root.current)
  })
  return (
    <group ref={root}>
      <InteriorLight />
      <Stagger gap={1200}>
        <group position={INTERIOR_ORIGIN.reciters}>
          <ReciterHall />
        </group>
        <group position={INTERIOR_ORIGIN.library}>
          <LibraryHall />
        </group>
        <group position={INTERIOR_ORIGIN.learning}>
          <Classroom />
        </group>
        <group position={INTERIOR_ORIGIN.community}>
          <Majlis />
        </group>
        <Ready root={root} />
      </Stagger>
    </group>
  )
}

/** One warm light that follows the interior being visited (keeps the shader light count fixed). */
function InteriorLight() {
  const ref = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const { rafid, view } = store.get()
    const l = ref.current
    if (!l) return
    const o = rafid && view === 'interior' ? INTERIOR_ORIGIN[rafid] : null
    const hall = rafid === 'reciters'
    // القرّاء: a soft warm FRONT fill (in front of and above the visitor, not over the reciter's
    // head) and a gentler ambient, so the white thobe / shemagh never blow out
    // hall: a soft warm key in front of and above the reciter's face (no top-down hot spot)
    if (o) l.position.set(o.x + (hall ? 0.8 : 0), hall ? 3.4 : 7.5, o.z + (hall ? 1.2 : 0))
    l.intensity = o ? (hall ? 5.5 : 28) : 0 // (hall slightly lower: the grade no longer darkens it)
    l.distance = hall ? 18 : 30
    if (hemi.current) hemi.current.intensity = o ? (hall ? 0.9 : 1.1) : 0
  })
  const hemi = useRef<THREE.HemisphereLight>(null)
  return (
    <>
      <pointLight ref={ref} color="#ffd29a" intensity={0} distance={30} decay={1.6} />
      <hemisphereLight ref={hemi} color="#ffdcae" groundColor="#7a5432" intensity={0} />
    </>
  )
}

function useMarbleFloor(size: number) {
  const tex = useTexture(['/textures/marble_01_diff.webp', '/textures/marble_01_nor_gl.webp', '/textures/marble_01_arm.webp'])
  return useMemo(() => {
    const [map, normalMap, arm] = tiled(tex, 3)
    void size
    return new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap: arm, color: '#f6ead8', roughness: 0.35, envMapIntensity: 0.9 })
  }, [tex, size])
}

/* ------------------------------ المكتبة ------------------------------ */

/** Round domed reading hall: bookshelf ring, reading desks, blue hologram pillar (video t044–t058). */
function LibraryHall() {
  const R = 13
  const floor = useMarbleFloor(R)
  const shelves = useMemo(() => {
    const list: Inst[] = []
    // continuous two-level ring of shelves (t050), gap only at the doorway toward +Z
    const n = 30
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3) continue
      list.push({ pos: [Math.sin(a) * (R - 0.8), 0, Math.cos(a) * (R - 0.8)], rotY: a + Math.PI, scale: [1.42, 1.3, 1.2] as const })
      list.push({ pos: [Math.sin(a) * (R - 0.8), 3.9, Math.cos(a) * (R - 0.8)], rotY: a + Math.PI, scale: [1.42, 1.3, 1.2] as const })
    }
    return list
  }, [])
  const desks = useMemo<Inst[]>(
    () => [0.9, 2.2, 3.9, 5.2].map((a) => ({ pos: [Math.sin(a) * 6.2, 0, Math.cos(a) * 6.2], rotY: a + Math.PI, scale: 1.1 })),
    [],
  )
  // carved dome: gold star lattice over warm stone, repeated around and up the dome
  const domeTex = useMemo(() => {
    const t = makeMashrabiyaTexture()
    t.repeat.set(18, 5)
    return t
  }, [])
  // warm lanterns hanging between the shelves (t050)
  const libLanterns = useMemo<Inst[]>(() => {
    const out: Inst[] = []
    for (let i = 0; i < 10; i++) {
      const a = ((i + 0.5) / 10) * Math.PI * 2
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.4) continue
      out.push({ pos: [Math.sin(a) * (R - 3.2), 5.6, Math.cos(a) * (R - 3.2)], rotY: a, scale: 1.4 })
    }
    return out
  }, [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} material={floor} receiveShadow>
        <circleGeometry args={[R, 64]} />
      </mesh>
      {/* walls (seen from inside only: the camera starts outside the doorway and dollies in) */}
      <mesh position={[0, 4.5, 0]}>
        <cylinderGeometry args={[R, R, 9, 64, 1, true]} />
        <meshStandardMaterial color="#5e4029" roughness={0.75} side={THREE.BackSide} />
      </mesh>
      {/* gallery balcony floor + gold rail */}
      <mesh position={[0, 3.75, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[R - 2.4, R, 96]} />
        <meshStandardMaterial color="#4a3020" roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 3.5, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[R - 1.6, 0.18, 8, 96]} />
        <meshStandardMaterial color="#c9963f" metalness={0.8} roughness={0.3} emissive="#6b4513" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 8.9, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[R - 0.1, 0.22, 8, 96]} />
        <meshStandardMaterial color="#c9963f" metalness={0.8} roughness={0.3} emissive="#6b4513" emissiveIntensity={0.4} />
      </mesh>
      {/* dome with a glowing oculus */}
      <mesh position={[0, 9, 0]}>
        <sphereGeometry args={[R, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial map={domeTex} color="#e8cfa3" roughness={0.7} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 9 + R - 0.05, 0]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[2.2, 48]} />
        <meshBasicMaterial color={new THREE.Color(1.05, 0.92, 0.72)} side={THREE.DoubleSide} />
      </mesh>
      <ModelInstances url={m('bookshelf')} list={shelves} prepare={ds} />
      <ModelInstances url={m('reading_desk')} list={desks} prepare={ds} />
      <ModelInstances url={m('lantern_hi')} list={libLanterns} shadows={false} prepare={(mt) => { ds(mt); mt.emissive.set('#ffb35c'); mt.emissiveIntensity = 0.8 }} />
      <LibraryWindows R={R} />
    </group>
  )
}

/**
 * Tall arched windows above the shelves with soft sunset beams falling into the hall (video t050):
 * the windows glow warm (unlit, under the bloom threshold), the beams are faint additive shafts.
 */
function LibraryWindows({ R }: { R: number }) {
  const beam = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
            float a = smoothstep(0.0, 0.7, across) * smoothstep(0.0, 0.35, vUv.y) * 0.16;
            gl_FragColor = vec4(vec3(1.0, 0.78, 0.48) * a, 1.0);
          }`,
      }),
    [],
  )
  const wins = useMemo(() => {
    const out: number[] = []
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) / 8) * Math.PI * 2
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.5) continue
      out.push(a)
    }
    return out
  }, [])
  // the low sun comes from -Z: beams tilt toward +Z and down
  return (
    <group>
      {wins.map((a) => (
        <group key={a} position={[Math.sin(a) * (R - 0.08), 0, Math.cos(a) * (R - 0.08)]} rotation-y={a + Math.PI}>
          <mesh position={[0, 7.9, 0]}>
            <planeGeometry args={[1.4, 1.7]} />
            <meshBasicMaterial color={new THREE.Color(1.15, 0.9, 0.6)} />
          </mesh>
          <mesh position={[0, 8.75, 0]}>
            <circleGeometry args={[0.7, 24, 0, Math.PI]} />
            <meshBasicMaterial color={new THREE.Color(1.15, 0.9, 0.6)} />
          </mesh>
          {/* light shaft from the window down into the hall */}
          <mesh material={beam} position={[0, 5.2, 3.6]} rotation-x={-0.95}>
            <planeGeometry args={[1.6, 9.5]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------ التعليم ------------------------------ */

/** Draws the smart-board UI (also used on the tablets). Basmala with tajweed colour coding, legend, progress. */
function drawBoard(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!
  const W = c.width, H = c.height
  const font = getComputedStyle(document.body).getPropertyValue('--font-alexandria') || 'sans-serif'
  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#06203d')
  bg.addColorStop(1, '#0c3a66')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  // faint UI grid
  g.strokeStyle = 'rgba(110, 210, 255, 0.07)'
  g.lineWidth = 2
  for (let x = 0; x < W; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke() }
  for (let y = 0; y < H; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke() }
  g.strokeStyle = 'rgba(110, 210, 255, 0.55)'
  g.lineWidth = 4
  g.strokeRect(14, 14, W - 28, H - 28)
  g.direction = 'rtl'
  // header
  g.textAlign = 'right'
  g.fillStyle = '#7fdcff'
  g.font = `600 54px ${font}`
  g.fillText('مسار التجويد', W - 70, 100)
  g.fillStyle = 'rgba(235, 245, 255, 0.85)'
  g.font = `400 34px ${font}`
  g.fillText('الدرس الثالث: المدود — التطبيق على البسملة', W - 70, 156)
  // verse, centred, with tajweed colour overlays (clip + redraw keeps the Arabic shaping intact)
  const verse = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'
  g.textAlign = 'center'
  g.font = `500 120px ${font}`
  const cx = W / 2, cy = 360
  g.fillStyle = '#f4f8ff'
  g.fillText(verse, cx, cy)
  const full = g.measureText(verse).width, xr = cx + full / 2
  const mark = (sub: string, color: string) => {
    const i = verse.indexOf(sub)
    if (i < 0) return
    const x1 = xr - g.measureText(verse.slice(0, i)).width
    const x0 = xr - g.measureText(verse.slice(0, i + sub.length)).width
    g.save()
    g.beginPath()
    g.rect(x0, cy - 150, x1 - x0, 210)
    g.clip()
    g.fillStyle = color
    g.fillText(verse, cx, cy)
    g.restore()
    g.fillStyle = color
    g.fillRect(x0 + 6, cy + 34, x1 - x0 - 12, 6)
  }
  mark('مَٰ', '#ff6b6b') // natural madd (dagger alif)
  mark('حِيمِ', '#ff9f43') // madd at the stop
  mark('لَّ', '#4cd97b') // shadda
  // legend chips
  const chips: [string, string][] = [['مدّ طبيعي', '#ff6b6b'], ['مدّ عارض', '#ff9f43'], ['تشديد', '#4cd97b'], ['قلقلة', '#5fb4ff']]
  g.font = `500 30px ${font}`
  g.textAlign = 'right'
  let x = W - 70
  for (const [label, col] of chips) {
    const w = g.measureText(label).width + 70
    g.fillStyle = 'rgba(255,255,255,0.06)'
    g.beginPath(); g.roundRect(x - w, 440, w, 58, 29); g.fill()
    g.fillStyle = col
    g.beginPath(); g.arc(x - 26, 469, 11, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#eaf4ff'
    g.fillText(label, x - 48, 480)
    x -= w + 20
  }
  // progress bars
  const bars: [string, number][] = [['الإظهار', 1], ['الإدغام', 0.72], ['الإخفاء', 0.45], ['المدود', 0.3]]
  bars.forEach(([label, val], k) => {
    const y = 560 + k * 66
    g.fillStyle = '#cfe9ff'
    g.font = `400 30px ${font}`
    g.textAlign = 'right'
    g.fillText(label, W - 70, y + 24)
    g.fillStyle = 'rgba(255,255,255,0.08)'
    g.beginPath(); g.roundRect(W * 0.3, y, W * 0.52, 22, 11); g.fill()
    const grad = g.createLinearGradient(W * 0.82, 0, W * 0.3, 0)
    grad.addColorStop(0, '#5fe1ff')
    grad.addColorStop(1, '#2d8cff')
    g.fillStyle = grad
    g.beginPath(); g.roundRect(W * 0.82 - W * 0.52 * val, y, W * 0.52 * val, 22, 11); g.fill()
    g.fillStyle = '#7fdcff'
    g.textAlign = 'left'
    g.fillText(`${Math.round(val * 100)}٪`, W * 0.3 - 110, y + 24)
  })
  // overall progress ring
  const rx = 230, ry = 680
  g.lineWidth = 22
  g.strokeStyle = 'rgba(255,255,255,0.1)'
  g.beginPath(); g.arc(rx, ry, 110, 0, Math.PI * 2); g.stroke()
  g.strokeStyle = '#5fe1ff'
  g.beginPath(); g.arc(rx, ry, 110, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.62); g.stroke()
  g.fillStyle = '#eaf4ff'
  g.textAlign = 'center'
  g.font = `600 56px ${font}`
  g.fillText('٦٢٪', rx, ry + 18)
}

function useCanvasTexture(w: number, h: number, draw: (c: HTMLCanvasElement) => void) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    const run = () => {
      draw(c)
      t.needsUpdate = true
    }
    run()
    void document.fonts?.ready.then(run)
    return t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h])
}

type HoloKind = 'letter' | 'wave' | 'score'

/** Small floating hologram panel UI: articulation point, recitation waveform, or a score. */
function drawHolo(kind: HoloKind) {
  return (c: HTMLCanvasElement) => {
    const g = c.getContext('2d')!, W = c.width, H = c.height
    const font = getComputedStyle(document.body).getPropertyValue('--font-alexandria') || 'sans-serif'
    g.clearRect(0, 0, W, H)
    g.fillStyle = 'rgba(40, 150, 255, 0.18)'
    g.fillRect(0, 0, W, H)
    g.strokeStyle = 'rgba(120, 220, 255, 0.9)'
    g.lineWidth = 6
    g.strokeRect(6, 6, W - 12, H - 12)
    g.fillStyle = '#bfefff'
    g.textAlign = 'center'
    g.direction = 'rtl'
    if (kind === 'letter') {
      g.font = `600 220px ${font}`
      g.fillText('ن', W / 2, H * 0.62)
      g.font = `400 40px ${font}`
      g.fillText('مخرج النون: طرف اللسان', W / 2, H * 0.88)
    } else if (kind === 'wave') {
      g.font = `500 40px ${font}`
      g.fillText('تلاوتك', W / 2, 70)
      for (let i = 0; i < 40; i++) {
        const h = (Math.sin(i * 0.7) * 0.5 + 0.5) * (Math.sin(i * 0.23 + 1) * 0.5 + 0.6) * H * 0.5
        g.fillStyle = i < 26 ? '#5fe1ff' : 'rgba(150,220,255,0.35)'
        g.fillRect(40 + i * ((W - 80) / 40), H * 0.6 - h / 2, (W - 80) / 40 - 6, h)
      }
    } else {
      g.font = `600 130px ${font}`
      g.fillText('٩٢', W / 2, H * 0.55)
      g.font = `400 40px ${font}`
      g.fillText('دقّة الأحكام', W / 2, H * 0.8)
    }
  }
}

/** Additive hologram material over a canvas texture, with scan lines and a faint flicker. */
function useHoloMaterial(tex: THREE.Texture) {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uMap: { value: tex }, uTime: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; uniform float uTime; varying vec2 vUv;
          void main() {
            vec4 t = texture2D(uMap, vUv);
            float scan = 0.82 + 0.18 * sin(vUv.y * 260.0 - uTime * 4.0);
            float flick = 0.94 + 0.06 * sin(uTime * 17.0);
            gl_FragColor = vec4(t.rgb * t.a * scan * flick * 1.1, 1.0);
          }`,
      }),
    [tex],
  )
}

function HoloPanel({ kind, position, rotY = 0 }: { kind: HoloKind; position: [number, number, number]; rotY?: number }) {
  const tex = useCanvasTexture(640, 400, drawHolo(kind))
  const mat = useHoloMaterial(tex)
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }, dt) => {
    mat.uniforms.uTime.value += dt
    if (ref.current) ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.8 + position[0]) * 0.06
  })
  return (
    <mesh ref={ref} material={mat} position={position} rotation-y={rotY}>
      <planeGeometry args={[1.6, 1.0]} />
    </mesh>
  )
}

/** Soft additive sun shaft (window -> floor). */
function useBeamMaterial(strength = 0.16) {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uK: { value: strength } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uK;
          varying vec2 vUv;
          void main() {
            float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
            float a = smoothstep(0.0, 0.7, across) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.8, vUv.y) * uK;
            gl_FragColor = vec4(vec3(1.0, 0.8, 0.5) * a, 1.0);
          }`,
      }),
    [strength],
  )
}

/** Arch-shaped warm sun patch on the floor (where a window's light lands). */
function useSunPatch() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 256
    const g = c.getContext('2d')!
    g.filter = 'blur(6px)'
    const grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, 'rgba(255,200,130,0.55)')
    grad.addColorStop(0.3, 'rgba(255,200,130,0.9)')
    grad.addColorStop(1, 'rgba(255,190,120,0.25)')
    g.fillStyle = grad
    g.beginPath()
    g.moveTo(16, 250)
    g.lineTo(16, 92)
    g.quadraticCurveTo(16, 26, 64, 6)
    g.quadraticCurveTo(112, 26, 112, 92)
    g.lineTo(112, 250)
    g.closePath()
    g.fill()
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending })
  }, [])
}

/** Carved wooden ceiling: star-lattice panels (the mashrabiya pattern, shaded as warm wood). */
function useCarvedCeiling(rx: number, ry: number) {
  return useMemo(() => {
    const t = makeMashrabiyaTexture(1)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(rx, ry)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshStandardMaterial({ map: t, color: '#b07c48', roughness: 0.7, emissive: '#3a220c', emissiveIntensity: 0.5, side: THREE.DoubleSide })
  }, [rx, ry])
}

/**
 * Smart classroom in a luxury Islamic building (video t064–t076, made high-tech): tall pointed-arch
 * windows along both side walls open onto palm gardens with fountains; warm sun shafts fall across
 * the desks; columns between the windows, hanging brass lanterns, a carved wooden ceiling. At the
 * front a glowing blue smart board in a gold pointed arch; a lit tablet at every seat.
 */
function Classroom() {
  const W = 18, D = 14, H = 7.5
  const floor = useMarbleFloor(W)
  const board = useCanvasTexture(2048, 860, drawBoard)
  const beam = useBeamMaterial(0.15)
  const patch = useSunPatch()
  const ceiling = useCarvedCeiling(9, 7)
  const desks = useMemo(() => {
    const list: Inst[] = []
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) list.push({ pos: [(c - 1.5) * 3.2, 0, -1.2 + r * 2.6], rotY: Math.PI, scale: 1.15 })
    return list
  }, [])
  const tablets = useMemo(() => {
    const out: [number, number, number][] = []
    for (const d of desks) for (const sx of [-0.42, 0.42]) out.push([d.pos[0] + sx, 0.88, d.pos[2] - 0.12])
    return out
  }, [desks])
  const boardArch = useMemo(() => makePointedArchWall(5.25, 0.35, 5.15, 1.7, 7.15, 0.25), [])
  // side walls: 3 tall pointed-arch windows per side (bay 4.4 m: opening 2.4 m, piers 2 m)
  const BAYS = [-4.4, 0, 4.4]
  const PIERS = [-6.6, -2.2, 2.2, 6.6]
  const SILL = 0.75, SPRING = 4.6, RISE = 1.5
  const winArch = useMemo(() => makePointedArchWall(1.2, 1.0, SPRING, RISE, H, 0.45), [])
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ead7b8', roughness: 0.72, side: THREE.DoubleSide }), [])
  const gold = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#c9963f', metalness: 0.75, roughness: 0.32, emissive: '#5a3a12', emissiveIntensity: 0.35 }),
    [],
  )
  const garden = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9fae6a', roughness: 0.95, emissive: '#3c4a1c', emissiveIntensity: 0.55 }), [])
  const gravel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e7d2ae', roughness: 0.85, emissive: '#5a4426', emissiveIntensity: 0.45 }), [])
  const gardenWall = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e2c79c', roughness: 0.85, emissive: '#6a4a26', emissiveIntensity: 0.5 }), [])
  const palms = useMemo<Inst[]>(() => {
    const out: Inst[] = []
    const spots: [number, number, number][] = [[13, -6.5, 1.0], [12.4, 1.8, 0.92], [14.5, 7.5, 1.05], [19, -2.5, 1.1], [20, 5, 0.95], [17.5, -10, 1.0], [24, 0.5, 1.15], [25, -8, 1.05]]
    for (const s of [-1, 1]) for (const [x, z, k] of spots) out.push({ pos: [s * x, 0, z], rotY: x * 1.7 + z * s, scale: k })
    return out
  }, [])
  const fountains = useMemo<Inst[]>(() => [{ pos: [-16, 0, 1.2], rotY: 0, scale: 1.1 }, { pos: [16, 0, 1.2], rotY: 0, scale: 1.1 }], [])
  const LANTERN_Y = H - 2.6
  const lanterns = useMemo<Inst[]>(
    () => [[-4.8, -2.6], [0, -2.6], [4.8, -2.6], [-4.8, 2.6], [0, 2.6], [4.8, 2.6]].map(([x, z]) => ({ pos: [x, LANTERN_Y, z], rotY: x, scale: 1.3 })),
    [LANTERN_Y],
  )
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} material={floor} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>
      {/* board wall (front) and back wall */}
      <mesh position={[0, H / 2, -D / 2]} material={stone}>
        <planeGeometry args={[W, H]} />
      </mesh>
      <mesh position={[0, H / 2, D / 2]} rotation-y={Math.PI} material={stone}>
        <planeGeometry args={[W, H]} />
      </mesh>
      {/* carved wooden ceiling with gold beams over the piers */}
      <mesh position={[0, H, 0]} rotation-x={Math.PI / 2} material={ceiling}>
        <planeGeometry args={[W, D]} />
      </mesh>
      {PIERS.map((z) => (
        <mesh key={z} position={[0, H - 0.18, z]} material={gold}>
          <boxGeometry args={[W, 0.32, 0.36]} />
        </mesh>
      ))}

      {/* side walls (local +Z = into the room, local x = side * world z) */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (W / 2), 0, 0]} rotation-y={(-side * Math.PI) / 2}>
          {BAYS.map((z) => (
            <group key={z} position={[side * z, 0, 0]}>
              <mesh geometry={winArch} material={stone} position={[0, 0, -0.225]} />
              <mesh position={[0, SILL / 2, 0]} material={stone}>
                <boxGeometry args={[2.4, SILL, 0.45]} />
              </mesh>
              <mesh position={[0, SILL + 0.03, 0.25]} material={gold}>
                <boxGeometry args={[2.5, 0.06, 0.08]} />
              </mesh>
              {/* sun shaft through this window, falling inward across the desks */}
              <mesh material={beam} position={[0, 3.0, 2.6]} rotation-x={-1.05}>
                <planeGeometry args={[2.2, 8.5]} />
              </mesh>
            </group>
          ))}
          {/* piers with engaged columns (gold capitals and bases) */}
          {PIERS.map((z) => {
            const end = Math.abs(z) > 6
            return (
              <group key={z} position={[side * z, 0, 0]}>
                <mesh position={[0, (end ? H : SPRING) / 2, 0]} material={stone}>
                  <boxGeometry args={[2.0, end ? H : SPRING, 0.45]} />
                </mesh>
                <mesh position={[0, SPRING / 2, 0.42]} material={stone}>
                  <cylinderGeometry args={[0.24, 0.27, SPRING, 24]} />
                </mesh>
                <mesh position={[0, SPRING + 0.12, 0.42]} material={gold}>
                  <cylinderGeometry args={[0.38, 0.26, 0.26, 24]} />
                </mesh>
                <mesh position={[0, 0.12, 0.42]} material={gold}>
                  <cylinderGeometry args={[0.34, 0.38, 0.24, 24]} />
                </mesh>
              </group>
            )
          })}
        </group>
      ))}
      {/* where the sun lands: soft arched patches on the floor between the desks */}
      {[-1, 1].map((s) =>
        BAYS.map((z) => (
          <mesh key={`${s}${z}`} material={patch} position={[s * (W / 2 - 5.2), 0.015, z]} rotation-x={-Math.PI / 2} rotation-z={(s * Math.PI) / 2}>
            <planeGeometry args={[2.2, 4.2]} />
          </mesh>
        )),
      )}

      {/* palm gardens with a fountain outside both walls, closed by a garden wall */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 20, -0.02, 0]} rotation-x={-Math.PI / 2} material={garden}>
            <planeGeometry args={[22, 40]} />
          </mesh>
          <mesh position={[s * 15.5, -0.01, 1.2]} rotation-x={-Math.PI / 2} material={gravel}>
            <planeGeometry args={[13, 2.4]} />
          </mesh>
          <mesh position={[s * 31, 2.2, 0]} material={gardenWall}>
            <boxGeometry args={[0.8, 4.4, 40]} />
          </mesh>
          {[-1, 1].map((e) => (
            <mesh key={e} position={[s * 20, 2.2, e * 20]} material={gardenWall}>
              <boxGeometry args={[22, 4.4, 0.8]} />
            </mesh>
          ))}
        </group>
      ))}
      <ModelInstances
        url={m('palm')}
        list={palms}
        prepare={(mt) => {
          mt.color.set('#b9d48e')
          mt.emissive.set('#3a3a18')
          mt.emissiveIntensity = 0.5
        }}
      />
      <ModelInstances
        url={m('fountain')}
        list={fountains}
        prepare={(mt) => {
          mt.emissive.set('#5a4a30')
          mt.emissiveIntensity = 0.45
        }}
      />

      {/* hanging brass lanterns */}
      <ModelInstances
        url={m('lantern_hi')}
        list={lanterns}
        shadows={false}
        prepare={(mt) => {
          ds(mt)
          mt.emissive.set('#ffb35c')
          mt.emissiveIntensity = 0.7
        }}
      />
      {lanterns.map((l, i) => (
        <mesh key={i} position={[l.pos[0], (LANTERN_Y + 1.4 + H) / 2, l.pos[2]]} material={gold}>
          <cylinderGeometry args={[0.015, 0.015, H - LANTERN_Y - 1.4, 6]} />
        </mesh>
      ))}

      {/* smart board wall (glowing) in a gold pointed-arch frame */}
      <mesh position={[0, 3.0, -D / 2 + 0.06]}>
        <planeGeometry args={[10.4, 4.36]} />
        <meshBasicMaterial map={board} color={new THREE.Color(1.3, 1.3, 1.3)} />
      </mesh>
      <mesh geometry={boardArch} material={gold} position={[0, 0, -D / 2 + 0.02]} />
      {[-1, 1].map((s) => (
        <mesh key={s} material={gold} position={[s * 5.42, 2.6, -D / 2 + 0.14]}>
          <boxGeometry args={[0.34, 5.2, 0.25]} />
        </mesh>
      ))}
      <HoloPanel kind="letter" position={[-6.9, 3.4, -D / 2 + 1.4]} rotY={0.5} />
      <HoloPanel kind="wave" position={[6.9, 3.4, -D / 2 + 1.4]} rotY={-0.5} />
      <HoloPanel kind="score" position={[0, 6.3, -D / 2 + 0.9]} />
      <mesh position={[0, 0.02, -D / 2 + 2.2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[11, 4]} />
        <meshBasicMaterial color="#2a8cff" transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <ModelInstances url={m('class_desk')} list={desks} prepare={ds} />
      {tablets.map((p, i) => (
        <mesh key={i} position={p} rotation-x={-Math.PI / 2 + 0.5}>
          <planeGeometry args={[0.34, 0.22]} />
          <meshBasicMaterial map={board} color={new THREE.Color(1.2, 1.2, 1.2)} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------ المجتمع ------------------------------ */

/** Majlis under an arcade open to the sea at sunset (video t080–t100). */
function Majlis() {
  const floor = useMarbleFloor(16)
  const { scene } = useGLTF(m('majlis'))
  const majlis = useMemo(() => scene.clone(true), [scene])
  useLayoutEffect(() => {
    tintScene(majlis, '#ffffff')
    majlis.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) (mesh.material as THREE.Material).side = THREE.DoubleSide
    })
  }, [majlis])
  const bays = useMemo<Inst[]>(() => {
    const list: Inst[] = []
    for (let i = 0; i < 4; i++) list.push({ pos: [(i - 1.5) * 4.75, 0, -6], rotY: 0, scale: 1 })
    for (const side of [-1, 1]) for (let i = 0; i < 2; i++) list.push({ pos: [side * 9.5, 0, -2.6 + i * 4.75], rotY: Math.PI / 2, scale: 1 })
    return list
  }, [])
  const lanterns = useMemo<Inst[]>(() => [[-4.2, -3.6], [4.2, -3.6], [-4.2, 3.4], [4.2, 3.4]].map(([x, z]) => ({ pos: [x, 0, z], rotY: 0, scale: 1.2 })), [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} material={floor} receiveShadow>
        <planeGeometry args={[20, 16]} />
      </mesh>
      {/* platform edge down to the sea */}
      <mesh position={[0, -1, 0]}>
        <boxGeometry args={[20.2, 2, 16.2]} />
        <meshStandardMaterial color="#e6d6bd" roughness={0.7} />
      </mesh>
      <ModelInstances url={m('arcade_bay')} list={bays} prepare={(mt) => mt.color.set('#EADBC3')} />
      <primitive object={majlis} position={[0, 0.01, 0]} scale={1.15} />
      <ModelInstances
        url={m('lantern_hi')}
        list={lanterns}
        shadows={false}
        prepare={(mt) => {
          ds(mt)
          mt.emissive.set('#ffb35c')
          mt.emissiveIntensity = 0.6
        }}
      />
    </group>
  )
}
