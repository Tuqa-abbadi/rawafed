'use client'

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ISLAND, POOL } from '@/lib/layout'
import { onHeroWall, shorePoints } from '@/lib/island'
import ModelInstances, { type Inst } from './ModelInstances'
import { PAVED, isFree } from './zones'
import { inEntranceSightline } from '@/lib/views'
import { seeded } from './shapes'
import { goldGlowMaterial } from '@/lib/materials'

// no module-level preload: map models stream in only after the hero is up (MapWorld)

export default function Vegetation() {
  const { palms, olives, lanterns } = useMemo(() => {
    const rand = seeded(57)
    const palms: Inst[] = []
    const add = (x: number, z: number) =>
      !inEntranceSightline(x, z) &&
      palms.push({ pos: [x + (rand() - 0.5) * 0.8, ISLAND.groundY, z + (rand() - 0.5) * 0.8], rotY: rand() * Math.PI * 2, scale: 1.35 + rand() * 0.5 }) // big lush palms (t032)
    const { promenadeInset: pi, promenadeWidth: pw } = ISLAND
    // keep the hero portal, terrace and colonnade clear (the hero camera looks out from there)
    const [hx0, hx1, hz0, hz1] = PAVED[PAVED.length - 1]
    const nearHero = (x: number, z: number) => x > hx0 - 6 && x < hx1 + 6 && z > hz0 - 4 && z < hz1 + 4
    // double palm row along the curved promenade (t012/t032): seaward and landward of it
    for (const [x, z] of shorePoints(-(pi - 2.4), 9)) if (!nearHero(x, z) && !onHeroWall(x, z)) add(x, z)
    for (const [x, z] of shorePoints(-(pi + pw + 2), 12)) if (isFree(x, z, 0.5) && !nearHero(x, z)) add(x, z)
    // main axis: palms either side of the long pool's channel
    for (let z = POOL.channel.z0 + 2; z <= POOL.channel.z1 + 2; z += 7) {
      add(-8.6, z)
      add(8.6, z)
    }
    // scattered garden palms
    let tries = 0
    while (palms.length < 145 && tries++ < 4000) {
      const x = THREE.MathUtils.lerp(-125, 125, rand())
      const z = THREE.MathUtils.lerp(-170, 10, rand())
      if (isFree(x, z, 3)) add(x, z)
    }

    const olivesAt: [number, number][] = [
      [-36, -21], [-20, -21], [-60, -76], [-44, -72], [55, -27], [73, -27], [-24, -63], [24, -63], [-13, -15], [13, -15],
    ]
    const olives: Inst[] = olivesAt.filter(([x, z]) => !inEntranceSightline(x, z, 4)).map(([x, z]) => ({ pos: [x, ISLAND.groundY, z], rotY: rand() * 6.28, scale: 1.1 + rand() * 0.3 }))

    const lanterns: Inst[] = []
    for (let z = -60; z <= -14; z += 4.6) {
      lanterns.push({ pos: [-9.6, 0, z], rotY: 0, scale: 1.3 }, { pos: [9.6, 0, z], rotY: 0, scale: 1.3 })
    }
    // along the landward edge of the promenade, front half of the island
    for (const [x, z] of shorePoints(-(pi + pw + 0.6), 11)) {
      if (z > -70 && Math.abs(x) > 11) lanterns.push({ pos: [x, 0, z], rotY: 0, scale: 1.3 })
    }
    return { palms, olives, lanterns }
  }, [])

  return (
    <group>
      <ModelInstances url="/models/palm.glb" list={palms} prepare={(m) => m.color.set('#b9d48e')} /* fresher green fronds (t032) */ />
      <ModelInstances url="/models/olive_tree.glb" list={olives} />
      <ModelInstances
        url="/models/lantern.glb"
        list={lanterns}
        shadows={false}
        // lanterns glow warm (few real lights; the bloom does the rest)
        prepare={(m) => {
          goldGlowMaterial(m, 2.2, '#ffcf80')
          m.emissive.set('#ffb35c')
          m.emissiveIntensity = 0.25
        }}
      />
    </group>
  )
}
