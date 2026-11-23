import * as THREE from 'three'
import gsap from './gsap'

export type Pose = { pos: THREE.Vector3; look: THREE.Vector3 }

/**
 * Camera controller used after the hero (map, buildings, interiors). CameraRig reads it every
 * frame: during a flight it follows the position/look splines, otherwise it holds `hold`.
 * `current` is what the camera shows right now (start point for the next flight).
 */
export const camCtl = {
  flight: null as null | { pos: THREE.CatmullRomCurve3; look: THREE.CatmullRomCurve3; t: number; len: number; tween: gsap.core.Tween },
  hold: null as Pose | null,
  current: { pos: new THREE.Vector3(), look: new THREE.Vector3() } as Pose,
  /** vertical half-fov tangent target (interiors are a bit wider) */
  tanV: 0.36,
  tanVFrom: 0.36,

  /** Fly along a spline through `pos`/`look` points (first points are replaced by the current pose). */
  fly(pos: THREE.Vector3[], look: THREE.Vector3[], duration = 3.6, opts: { ease?: string; tanV?: number } = {}) {
    this.flight?.tween.kill()
    const p = [this.current.pos.clone(), ...pos.slice(1)]
    const l = [this.current.look.clone(), ...look.slice(1)]
    const posCurve = new THREE.CatmullRomCurve3(p, false, 'centripetal')
    const lookCurve = new THREE.CatmullRomCurve3(l, false, 'centripetal')
    this.tanVFrom = this.tanV
    const tanVTo = opts.tanV ?? this.tanV
    return new Promise<void>((resolve) => {
      const f = { pos: posCurve, look: lookCurve, t: 0, len: posCurve.getLength(), tween: null as unknown as gsap.core.Tween }
      f.tween = gsap.to(f, {
        t: 1,
        duration,
        ease: opts.ease ?? 'power2.inOut',
        onUpdate: () => {
          this.tanV = THREE.MathUtils.lerp(this.tanVFrom, tanVTo, f.t)
        },
        onComplete: () => {
          this.hold = { pos: p[p.length - 1].clone(), look: l[l.length - 1].clone() }
          this.flight = null
          resolve()
        },
      })
      this.flight = f
    })
  },

  /** Cut straight to a pose (behind a fade). */
  jump(pose: Pose, tanV?: number) {
    this.flight?.tween.kill()
    this.flight = null
    this.hold = { pos: pose.pos.clone(), look: pose.look.clone() }
    if (tanV !== undefined) this.tanV = this.tanVFrom = tanV
  },
}
