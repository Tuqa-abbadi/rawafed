'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import Sky from '../Sky'
import { GoldenGrade } from '@/effects/GoldenGrade'
import { sunDirection } from '@/lib/sky'

type Params = { m: string; az: number; el: number; fov: number; dist: number; ty: number }

function readParams(): Params {
  const q = new URLSearchParams(window.location.search)
  const n = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d)
  return { m: q.get('m') ?? 'reciters', az: n('az', 25), el: n('el', 18), fov: n('fov', 40), dist: n('dist', 1.15), ty: n('ty', 0.45) }
}

/** Loads public/models/<m>.glb, frames it from (az, el), reports stats on window.__model. */
function Model({ p, onReady }: { p: Params; onReady: (info: string) => void }) {
  const { scene } = useGLTF(`/models/${p.m}.glb`)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera

  const info = useMemo(() => {
    let tris = 0
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = mesh.receiveShadow = true
        const g = mesh.geometry
        tris += (g.index ? g.index.count : g.attributes.position.count) / 3
      }
    })
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    return { tris: Math.round(tris), size, box }
  }, [scene])

  useEffect(() => {
    const { box, size } = info
    const radius = size.length() / 2
    const target = new THREE.Vector3(0, box.min.y + size.y * p.ty, 0)
    const az = THREE.MathUtils.degToRad(p.az), el = THREE.MathUtils.degToRad(p.el)
    camera.fov = p.fov
    const d = (radius / Math.sin(THREE.MathUtils.degToRad(p.fov) / 2)) * p.dist
    camera.position.set(target.x + d * Math.cos(el) * Math.sin(az), target.y + d * Math.sin(el), target.z + d * Math.cos(el) * Math.cos(az))
    camera.near = d / 200; camera.far = d * 20
    camera.lookAt(target); camera.updateProjectionMatrix()
    const text = `${p.m} · ${info.tris.toLocaleString()} tris · ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} m (w × h × d)`
    ;(window as unknown as { __model: unknown }).__model = { name: p.m, tris: info.tris, size: size.toArray() }
    onReady(text)
  }, [info, camera, p, onReady])

  return <primitive object={scene} />
}

function Ground({ size }: { size: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <circleGeometry args={[size, 64]} />
      <meshStandardMaterial color="#d8ccb6" roughness={0.9} />
    </mesh>
  )
}

export default function ModelViewer() {
  const [p] = useState(readParams)
  const [info, setInfo] = useState('loading…')
  const sun = useMemo(() => sunDirection.clone().multiplyScalar(200).add(new THREE.Vector3(0, 60, 0)), [])

  return (
    <>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: p.fov }} gl={{ antialias: false }}>
        <Suspense fallback={null}>
          <Sky />
          <directionalLight position={sun} intensity={2.2} color="#ffd9a8" castShadow shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-120} shadow-camera-right={120} shadow-camera-top={120} shadow-camera-bottom={-120} shadow-camera-far={600} shadow-bias={-0.0005} />
          <Model p={p} onReady={setInfo} />
          <Ground size={400} />
        </Suspense>
        <EffectComposer multisampling={4} frameBufferType={THREE.HalfFloatType}>
          <GoldenGrade exposure={0.5} />
        </EffectComposer>
      </Canvas>
      <div data-ready={info !== 'loading…'} className="dev-info" dir="ltr">{info}</div>
    </>
  )
}
