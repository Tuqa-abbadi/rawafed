'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { firstMesh } from '@/lib/materials'

export type Inst = { pos: readonly [number, number, number] | number[]; rotY: number; scale: number | readonly [number, number, number] }

/**
 * One instanced draw call for many copies of a single-mesh Meshy model. The node matrix is kept
 * separate (quantized positions) and multiplied into every instance.
 */
export default function ModelInstances({
  url,
  list,
  shadows = true,
  prepare,
}: {
  url: string
  list: Inst[]
  shadows?: boolean
  /** adjust the (cloned) material once, e.g. tint or glow */
  prepare?: (m: THREE.MeshStandardMaterial) => void
}) {
  const { scene } = useGLTF(url)
  const part = useMemo(() => {
    const p = firstMesh(scene)
    const material = p.material.clone()
    prepare?.(material)
    return { ...p, material }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])
  const ref = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
    list.forEach((it, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rotY)
      if (typeof it.scale === 'number') s.setScalar(it.scale)
      else s.set(it.scale[0], it.scale[1], it.scale[2])
      p.set(it.pos[0], it.pos[1], it.pos[2])
      m.compose(p, q, s).multiply(part.matrix)
      im.setMatrixAt(i, m)
    })
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [list, part])

  return (
    <instancedMesh
      ref={ref}
      args={[part.geometry, part.material, Math.max(1, list.length)]}
      count={list.length}
      castShadow={shadows}
      receiveShadow={shadows}
    />
  )
}
