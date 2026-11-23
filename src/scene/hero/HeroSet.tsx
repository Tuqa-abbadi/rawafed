'use client'

import { Suspense, useEffect, useLayoutEffect, useMemo } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import { Detailed, useGLTF, useTexture } from '@react-three/drei'
import { store, useStore } from '@/lib/store'
import { LOD_DISTANCE, highUrl } from '@/lib/lod'
import * as THREE from 'three'
import { HERO } from '@/lib/layout'
import { addGoldGlow, goldGlowMaterial, tintScene } from '@/lib/materials'
import ModelInstances, { type Inst } from '../map/ModelInstances'
import { COLONNADE } from '@/lib/story'
import { makeMashrabiyaTexture, makePointedArchWall, makeStoneTexture } from './portalTextures'

const GATEWAY = '/models/gateway_interior.glb'
const ARCADE = '/models/arcade_bay.glb'
const OLIVE = '/models/olive_tree.glb'
;[OLIVE].forEach((u) => useGLTF.preload(u))
// gateway_interior (6.5 MB) and arcade_bay (4 MB) are not in the first view (the camera starts in
// the sky, then sits inside the portal looking out): they stream in during the intro (HeroLate)

const STONE = '#EADBC3' // warm ivory stone (video pillars), multiplies the Meshy texture

/** Marble maps (Poly Haven marble_01, 1k) tiled every `tile` metres over a w x h face. */
function useMarble(w: number, h: number, tile = 2.5) {
  const [map, normalMap, arm] = useTexture([
    '/textures/marble_01_diff.webp',
    '/textures/marble_01_nor_gl.webp',
    '/textures/marble_01_arm.webp',
  ])
  return useMemo(() => {
    const ts = [map, normalMap, arm].map((t) => {
      const c = t.clone()
      c.wrapS = c.wrapT = THREE.RepeatWrapping
      c.repeat.set(w / tile, h / tile)
      c.anisotropy = 8
      c.needsUpdate = true
      return c
    })
    ts[0].colorSpace = THREE.SRGBColorSpace
    return { map: ts[0], normalMap: ts[1], roughnessMap: ts[2], aoMap: ts[2] }
  }, [map, normalMap, arm, w, h, tile])
}

function MarbleFloor({ w, d, ...props }: { w: number; d: number } & ThreeElements['mesh']) {
  const maps = useMarble(w, d, 3)
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow {...props}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial {...maps} color="#f3e7d3" roughness={0.75} metalness={0} envMapIntensity={0.6} />
    </mesh>
  )
}

/** Shared ivory stone for the portal: plain pale limestone with faint joints (video t004). */
function useStone() {
  const [normalMap] = useTexture(['/textures/marble_01_nor_gl.webp'])
  return useMemo(() => {
    const map = makeStoneTexture()
    const n = normalMap.clone()
    n.wrapS = n.wrapT = THREE.RepeatWrapping
    n.repeat.set(0.5, 0.5)
    n.needsUpdate = true
    return new THREE.MeshStandardMaterial({
      map, normalMap: n, normalScale: new THREE.Vector2(0.25, 0.25),
      color: '#efdcc0', roughness: 0.55, metalness: 0, envMapIntensity: 1,
    })
  }, [normalMap])
}

/** Box with UVs in metres (stone courses 1 m x 1.5 m) so the joints keep their size on any face. */
function stoneBox(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  const nrm = g.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i))
    const su = ax > 0.5 ? d : w // face width along u
    const sv = ay > 0.5 ? d : h
    uv.setXY(i, uv.getX(i) * su, (uv.getY(i) * sv) / 1.5)
  }
  return g
}

/** Slim ivory pillar (video t002: face ~10% of the frame) with a plinth. */
function Pillar({ side, material }: { side: -1 | 1; material: THREE.Material }) {
  const { pillarWidth: w, pillarDepth: d, pillarHeight: h, portalHalfOpening: half, portalZ } = HERO
  const body = useMemo(() => stoneBox(w, h, d), [w, h, d])
  const plinth = useMemo(() => stoneBox(w + 0.1, 0.6, d + 0.1), [w, d])
  const x = side * (half + w / 2)
  return (
    <group position={[x, 0, portalZ - d / 2]}>
      <mesh geometry={body} material={material} position={[0, h / 2, 0]} castShadow receiveShadow />
      <mesh geometry={plinth} material={material} position={[0, 0.3, 0]} castShadow receiveShadow />
    </group>
  )
}

/**
 * Warm gold glow along the portal's INNER edge (video opening: the arch frame catches the low sun):
 * a thin bright line up each pillar's inner edge and around the pointed arch, with a soft halo.
 */
function ArchGlow() {
  const { portalHalfOpening: half, archSpring: spring, archRise: rise, portalZ, pillarDepth: d } = HERO
  const geos = useMemo(() => {
    const cx = (rise * rise - half * half) / (2 * half)
    const R = half + cx
    const apex = Math.acos(-cx / R)
    const pts: THREE.Vector3[] = []
    const N = 24
    for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(-half, (spring * i) / 8, 0))
    for (let i = 1; i <= N; i++) {
      const a = Math.PI + ((apex - Math.PI) * i) / N
      pts.push(new THREE.Vector3(cx + R * Math.cos(a), spring + R * Math.sin(a), 0))
    }
    for (let i = 1; i <= N; i++) {
      const a = Math.PI - apex + ((0 - (Math.PI - apex)) * i) / N
      pts.push(new THREE.Vector3(-cx + R * Math.cos(a), spring + R * Math.sin(a), 0))
    }
    for (let i = 1; i <= 8; i++) pts.push(new THREE.Vector3(half, spring - (spring * i) / 8, 0))
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    return {
      line: new THREE.TubeGeometry(curve, 240, 0.02, 6, false),
      halo: new THREE.TubeGeometry(curve, 240, 0.075, 8, false),
    }
  }, [half, spring, rise])
  const mats = useMemo(
    () => ({
      line: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.12, 0.52), toneMapped: false }),
      halo: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.62, 0.26), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
    }),
    [],
  )
  // on the inner faces, mid-depth of the portal
  return (
    <group position={[0, 0, portalZ - d / 2]}>
      <mesh geometry={geos.line} material={mats.line} />
      <mesh geometry={geos.halo} material={mats.halo} />
    </group>
  )
}

/** Gold mashrabiya screen beside a pillar, back-lit by the sun (t002 frame edges). */
function Mashrabiya({ side }: { side: -1 | 1 }) {
  const { pillarWidth: w, portalHalfOpening: half, portalZ, mashrabiyaWidth: mw, mashrabiyaHeight: mh } = HERO
  const material = useMemo(() => {
    const map = makeMashrabiyaTexture()
    map.repeat.set(mw / 0.3, mh / 0.3) // ~30 cm stars (t002)
    // unlit and a little over 1: light coming through the screen from the low sun
    return new THREE.MeshBasicMaterial({ map, color: new THREE.Color(1.15, 1.0, 0.85) })
  }, [mw, mh])
  return (
    <group position={[side * (half + w + mw / 2), 0, portalZ - 0.35]}>
      <mesh material={material} position={[0, mh / 2, 0]}>
        <planeGeometry args={[mw, mh]} />
      </mesh>
      {/* bronze frame along the pillar side */}
      <mesh position={[-side * (mw / 2 - 0.04), mh / 2, 0.02]}>
        <boxGeometry args={[0.08, mh, 0.06]} />
        <meshStandardMaterial color="#6b4520" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* stone frame above the screen */}
      <mesh position={[0, mh + 0.15, 0.05]} castShadow>
        <boxGeometry args={[mw, 0.3, 0.3]} />
        <meshStandardMaterial color="#e9d8bd" roughness={0.6} />
      </mesh>
    </group>
  )
}

/** gateway_interior: LOW at first; the HIGH LOD swaps in near the camera once requested + loaded. */
function GatewayLod({ low }: { low: THREE.Object3D }) {
  const want = useStore((st) => !!st.hi.gateway_interior)
  if (!want) return <primitive object={low} />
  return (
    <Suspense fallback={<primitive object={low} />}>
      <GatewayHigh low={low} />
    </Suspense>
  )
}

function GatewayHigh({ low }: { low: THREE.Object3D }) {
  const high = useGLTF(highUrl('gateway_interior')).scene
  useLayoutEffect(() => {
    tintScene(high, STONE)
    addGoldGlow(high, 0.35)
  }, [high])
  return (
    <Detailed distances={[0, LOD_DISTANCE.gateway_interior]}>
      <primitive object={high} />
      <primitive object={low} />
    </Detailed>
  )
}

/** Portal, mashrabiya side walls, terrace, sea wall, olive tree and the shore colonnade. */
/** The parts of the hero that load after the first view (they are behind / beside the opening). */
function HeroLate() {
  const gateway = useGLTF(GATEWAY).scene
  useLayoutEffect(() => {
    tintScene(gateway, STONE)
    addGoldGlow(gateway, 0.35)
  }, [gateway])
  const bays = useMemo<Inst[]>(
    () => Array.from({ length: COLONNADE.count }, (_, i) => ({ pos: [COLONNADE.x0 - i * COLONNADE.spacing, -0.2, COLONNADE.z], rotY: Math.PI / 2, scale: 1 })),
    [],
  )
  useEffect(() => {
    store.set({ heroLate: true })
  }, [])
  return (
    <>
      {/* gateway_interior = the portal's outer (sea-side) face, opening aligned with the pillars:
          seen through from inside, and as a gold mashrabiya facade from the sea / during the flight */}
      <group position={[0, 0, HERO.portalZ - 1.9]} scale={1.3}>
        <GatewayLod low={gateway} />
      </group>
      {/* each arcade_bay has a 20 cm base slab: sunk by 0.2 so the walk is one flat marble floor */}
      <ModelInstances
        url={ARCADE}
        list={bays}
        prepare={(m) => {
          m.color.set(STONE)
          goldGlowMaterial(m, 0.25)
        }}
      />
    </>
  )
}

export default function HeroSet() {
  const olive = useGLTF(OLIVE).scene
  const late = useStore((st) => st.phase !== 'loading')

  useLayoutEffect(() => {
    tintScene(olive, '#ffffff')
  }, [olive])

  const stone = useStone()
  const archGeo = useMemo(
    () => makePointedArchWall(HERO.portalHalfOpening, HERO.pillarWidth, HERO.archSpring, HERO.archRise, HERO.pillarHeight, HERO.pillarDepth),
    [],
  )
  // shore colonnade (scroll story, HeroLate): arches in a row along -X, each turned so its opening
  // faces the direction of travel — the walker passes through them, the sea shows between the columns
  const pier = COLONNADE.platform

  const terraceDepth = 30 // from z=-128 to the sea wall at -158
  const terraceCenterZ = HERO.terraceFrontZ + terraceDepth / 2

  return (
    <group>
      <Pillar side={-1} material={stone} />
      <Pillar side={1} material={stone} />
      {/* pointed arch over the opening; it springs just above the top of the frame at the start (t002) */}
      <mesh geometry={archGeo} material={stone} position={[0, 0, HERO.portalZ - HERO.pillarDepth]} castShadow receiveShadow />
      <Mashrabiya side={-1} />
      <Mashrabiya side={1} />
      <ArchGlow />

      {late && (
        <Suspense fallback={null}>
          <HeroLate />
        </Suspense>
      )}

      <MarbleFloor w={70} d={terraceDepth} position={[-15, HERO.terraceTopY, terraceCenterZ]} />
      <mesh position={[-15, (HERO.terraceTopY + HERO.waterY) / 2 - 0.6, HERO.terraceFrontZ - 0.25]} receiveShadow castShadow>
        <boxGeometry args={[70, HERO.terraceTopY - HERO.waterY + 1.2, 0.5]} />
        <meshStandardMaterial color="#e6d6bd" roughness={0.6} />
      </mesh>
      {/* olive tree in its planter, beyond the right pillar (the walker's path goes left) */}
      <primitive object={olive} position={[4.7, 0, -153.9]} rotation-y={0.6} scale={1.1} />

      {/* stone pier carrying the colonnade along the shore, west of the gateway */}
      <MarbleFloor w={pier.x1 - pier.x0} d={HERO.terraceFrontZ - pier.z0} position={[(pier.x0 + pier.x1) / 2, HERO.terraceTopY + 0.004, (HERO.terraceFrontZ + pier.z0) / 2]} />
      <mesh position={[(pier.x0 + pier.x1) / 2, (HERO.terraceTopY + HERO.waterY) / 2 - 0.6, (HERO.terraceFrontZ + pier.z0) / 2 - 0.02]} receiveShadow castShadow>
        <boxGeometry args={[pier.x1 - pier.x0, HERO.terraceTopY - HERO.waterY + 1.2, HERO.terraceFrontZ - pier.z0]} />
        <meshStandardMaterial color="#e6d6bd" roughness={0.6} />
      </mesh>
    </group>
  )
}
