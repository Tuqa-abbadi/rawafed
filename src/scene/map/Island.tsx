'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { COMMUNITY_PLAZA, ISLAND, POOL } from '@/lib/layout'
import { inland, onHeroWall, outlineShape, shoreOutline, shorePoints } from '@/lib/island'
import { setNoReflect } from '@/lib/layers'
import { CANAL, PAVED, isFree } from './zones'
import { circle, flat, rect, seeded, tiled } from './shapes'

/** Water in pools/canals: still and mirror-like, picks up the sunset sky from the environment. */
export function usePoolWater() {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#4f939b', metalness: 0.45, roughness: 0.12, envMapIntensity: 1.1,
        // always wins over the paving it sits in
        polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
      }),
    [],
  )
}

/** Extruded slab from an outline: top at `top`, `depth` metres deep; groups 0 = caps, 1 = sides. */
function slab(pts: [number, number][], top: number, depth: number) {
  const g = new THREE.ExtrudeGeometry(outlineShape(pts), { depth, bevelEnabled: false, curveSegments: 4 })
  g.rotateX(-Math.PI / 2) // extrusion (+Z) -> up (+Y)
  g.translate(0, top - depth, 0)
  return g
}

/** The long pool outline (basin in front of القرّاء + channel down the axis), world [x, z]. */
function poolOutline(inset = 0): [number, number][] {
  const { basin: b, channel: c } = POOL
  const bw = b.halfW - inset, cw = c.halfW - inset
  const z0 = b.z0 + inset, zJ = b.z1 + inset, z1 = c.z1 - inset
  return [
    [-bw, z0], [bw, z0], [bw, zJ], [cw, zJ], [cw, z1], [-cw, z1], [-cw, zJ], [-bw, zJ],
  ]
}

/**
 * Island: organic coastline (src/lib/island.ts) with lawn, a thin sandy strip and a sandstone rock
 * edge with boulders; marble paths and a promenade that follows the curved shore; the long
 * reflecting pool with fountain jets; canal; shrubs.
 */
export default function Island() {
  const { groundY, sandWidth, promenadeInset: pi, promenadeWidth: pw } = ISLAND

  const grassTex = useTexture(['/textures/sparse_grass_diff.webp', '/textures/sparse_grass_nor_gl.webp'])
  const rockTex = useTexture(['/textures/sandstone_blocks_08_diff.webp', '/textures/sandstone_blocks_08_nor_gl.webp'])
  const marbleTex = useTexture(['/textures/marble_01_diff.webp', '/textures/marble_01_nor_gl.webp'])

  const ground = useMemo(() => {
    const [, gn] = tiled(grassTex, 7) // the Poly Haven grass albedo is mostly soil: normal map only
    const [rm, rn] = tiled(rockTex, 2.5)
    const grass = new THREE.MeshStandardMaterial({ normalMap: gn, normalScale: new THREE.Vector2(0.6, 0.6), color: '#4d6c34', roughness: 0.92 })
    const sand = new THREE.MeshStandardMaterial({ color: '#e6d2ad', roughness: 0.95 })
    const rock = new THREE.MeshStandardMaterial({ map: rm, normalMap: rn, color: '#ead6b6', roughness: 0.9 })
    return {
      lawn: slab(shoreOutline(0), groundY, 0.14), // lawn top; its thin side reads as the sand lip
      shore: slab(shoreOutline(sandWidth), groundY - 0.12, 2.2), // sandy strip on top, rock edge below
      mats: { lawn: [grass, sand], shore: [sand, rock], rock },
    }
  }, [grassTex, rockTex, groundY, sandWidth])

  const paths = useMemo(() => {
    const shapes: THREE.Shape[] = []
    // promenade following the curved shore (t012/t032: palm-lined)
    shapes.push(outlineShape(shoreOutline(-pi), shoreOutline(-pi - pw)))
    // the hero terrace has its own marble floor (HeroSet) — skip the last PAVED entry
    for (const [x0, x1, z0, z1] of PAVED.slice(0, -1)) shapes.push(rect(x0, x1, z0, z1))
    shapes.push(circle(COMMUNITY_PLAZA.x, COMMUNITY_PLAZA.z, COMMUNITY_PLAZA.r))
    const g = flat(shapes, groundY + 0.04, 16)
    const [, mn] = tiled(marbleTex, 4) // pale cream paving: marble relief only (its albedo reads sandy)
    const mat = new THREE.MeshStandardMaterial({
      normalMap: mn, normalScale: new THREE.Vector2(0.4, 0.4), color: '#f3e9da', roughness: 0.6,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    })
    return { g, mat }
  }, [marbleTex, pi, pw, groundY])

  // inner ring of the community plaza in a warmer stone (t038)
  const plazaInner = useMemo(() => {
    const s = circle(COMMUNITY_PLAZA.x, COMMUNITY_PLAZA.z, COMMUNITY_PLAZA.r * 0.62)
    s.holes.push(circle(COMMUNITY_PLAZA.x, COMMUNITY_PLAZA.z, COMMUNITY_PLAZA.r * 0.52) as unknown as THREE.Path)
    return flat(s, groundY + 0.06, 48)
  }, [groundY])

  const water = usePoolWater()
  const wet = useMemo(() => {
    const pool = flat(outlineShape(poolOutline()), POOL.waterY)
    const canal = flat(rect(CANAL.x - CANAL.width / 2, CANAL.x + CANAL.width / 2, CANAL.z0, CANAL.z1), groundY + 0.12)
    return [pool, canal]
  }, [groundY])

  // raised pool rim (one continuous curb around basin + channel) and canal curbs
  const curbs = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(outlineShape(poolOutline(-POOL.curbT), poolOutline()), { depth: POOL.curbH, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    const list: { p: [number, number, number]; s: [number, number, number] }[] = []
    const cx0 = CANAL.x - CANAL.width / 2, cx1 = CANAL.x + CANAL.width / 2
    const len = CANAL.z1 - CANAL.z0 - 2.5
    list.push({ p: [cx0 - 0.3, 0.17, CANAL.z0 + len / 2], s: [0.6, 0.35, len] })
    list.push({ p: [cx1 + 0.3, 0.17, CANAL.z0 + len / 2], s: [0.6, 0.35, len] })
    list.push({ p: [CANAL.x, 0.17, CANAL.z0 - 0.3], s: [CANAL.width + 1.2, 0.35, 0.6] })
    return { pool: g, canal: list }
  }, [])

  const detail = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    if (detail.current) setNoReflect(detail.current)
  })

  return (
    <group>
      <mesh geometry={ground.lawn} material={ground.mats.lawn} receiveShadow />
      <mesh geometry={ground.shore} material={ground.mats.shore} receiveShadow />
      <Boulders material={ground.mats.rock} />
      <mesh geometry={curbs.pool} castShadow receiveShadow>
        <meshStandardMaterial color="#efe2cc" roughness={0.55} />
      </mesh>
      <mesh geometry={wet[0]} material={water} />
      <group ref={detail}>
        <mesh geometry={paths.g} material={paths.mat} receiveShadow />
        <mesh geometry={plazaInner} receiveShadow>
          <meshStandardMaterial color="#d9bf98" roughness={0.6} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
        <mesh geometry={wet[1]} material={water} />
        {curbs.canal.map((c, i) => (
          <mesh key={i} position={c.p} castShadow receiveShadow>
            <boxGeometry args={c.s} />
            <meshStandardMaterial color="#efe2cc" roughness={0.6} />
          </mesh>
        ))}
        <FountainJets />
        <Shrubs />
      </group>
    </group>
  )
}

/** Natural rock edge: weathered sandstone boulders along the outer edge of the sandy strip. */
function Boulders({ material }: { material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const list = useMemo(() => {
    const rand = seeded(91)
    // irregular: clusters and gaps, mixed sizes, sitting low in the water
    return shorePoints(ISLAND.sandWidth + 0.4, 1.9)
      .filter(([x, z]) => !onHeroWall(x, z) && Math.sin(x * 0.11 + z * 0.07) + rand() * 0.9 > 0.1)
      .map(([x, z]) => ({ x: x + (rand() - 0.5) * 1.6, z: z + (rand() - 0.5) * 1.6, s: 0.4 + rand() * rand() * 1.4, r: rand() * 6.28 }))
  }, [])
  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion()
    list.forEach((b, i) => {
      q.setFromEuler(new THREE.Euler(b.r * 0.3, b.r, b.r * 0.2))
      m.compose(new THREE.Vector3(b.x, -0.45, b.z), q, new THREE.Vector3(b.s * 1.4, b.s * 0.6, b.s))
      im.setMatrixAt(i, m)
    })
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [list])
  const geo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), [])
  return <instancedMesh ref={ref} args={[geo, material, list.length]} castShadow receiveShadow />
}

/** Fountain jets along the long pool (t032/t038): soft white water columns. */
function FountainJets() {
  const jets = useMemo(() => {
    const list: [number, number][] = []
    for (let z = POOL.channel.z0 + 4; z <= POOL.channel.z1 - 3; z += 5) list.push([0, z])
    list.push([-6.5, -73.8], [6.5, -73.8], [0, -78])
    return list
  }, [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv; varying float vSeed;
          void main() {
            vUv = uv;
            vSeed = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 0.37;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; varying vec2 vUv; varying float vSeed;
          void main() {
            // bright column with a frothy flicker, fading toward the top
            float flick = 0.75 + 0.25 * sin(vUv.y * 40.0 - uTime * 14.0 + vSeed);
            float a = (1.0 - smoothstep(0.55, 1.0, vUv.y)) * flick * 0.8;
            gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * 1.6, a);
          }`,
      }),
    [],
  )
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    const m = new THREE.Matrix4()
    jets.forEach(([x, z], i) => {
      m.makeTranslation(x, POOL.waterY, z)
      im.setMatrixAt(i, m)
    })
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [jets])
  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt
  })
  // tapered column: wide at the base, thin at the top
  const geo = useMemo(() => new THREE.CylinderGeometry(0.06, 0.32, 3.2, 10, 1, true).translate(0, 1.6, 0), [])
  return <instancedMesh ref={ref} args={[geo, material, jets.length]} renderOrder={3} />
}

/** Lush garden: instanced shrub clumps in every free patch inland of the promenade (t032). */
function Shrubs({ count = 1100 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const list = useMemo(() => {
    const rand = seeded(31)
    const out: { x: number; z: number; s: number; h: number; c: THREE.Color }[] = []
    const greens = ['#3f6f2c', '#4c7d31', '#35612a', '#5b8a37', '#2f5a26'].map((c) => new THREE.Color(c))
    let tries = 0
    while (out.length < count && tries < count * 30) {
      tries++
      const x = THREE.MathUtils.lerp(-125, 125, rand())
      const z = THREE.MathUtils.lerp(-170, 10, rand())
      if (!isFree(x, z, 1.2)) continue
      // gardens only: the strip between the promenade and the sea keeps just the palm row
      if (inland(x, z) < ISLAND.promenadeInset + ISLAND.promenadeWidth + 1) continue
      const s = 1.3 + rand() * 2.4
      out.push({ x, z, s, h: 0.6 + rand() * 0.6, c: greens[Math.floor(rand() * greens.length)].clone().multiplyScalar(0.85 + rand() * 0.3) })
    }
    return out
  }, [count])

  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion()
    list.forEach((b, i) => {
      q.setFromEuler(new THREE.Euler(0, b.x * 0.37 + b.z, 0))
      m.compose(new THREE.Vector3(b.x, ISLAND.groundY + b.s * b.h * 0.35, b.z), q, new THREE.Vector3(b.s, b.s * b.h, b.s))
      im.setMatrixAt(i, m)
      im.setColorAt(i, b.c)
    })
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    im.computeBoundingSphere()
  }, [list])

  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 2), [])
  return (
    <instancedMesh ref={ref} args={[geo, undefined, list.length]} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.95} />
    </instancedMesh>
  )
}
