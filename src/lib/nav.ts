import gsap from './gsap'
import * as THREE from 'three'
import { camCtl } from './camera'
import { mapCameraFor } from './layout'
import { requestHigh, store, type RafidKey } from './store'
import { modelsOf } from './lod'
import { player } from './recitation'
import { storyScroll } from '@/components/StoryScroll'
import { INTERIOR_ORIGIN, INTERIOR_SHOT, pathInto } from './views'

/**
 * Click-driven navigation (no free camera): map <-> building entrance <-> interior, and home.
 * Every move is a predefined spline flight (CLAUDE.md) or a short fade cut into an interior set.
 */

const aspect = () => (typeof window === 'undefined' ? 16 / 9 : window.innerWidth / window.innerHeight)
const mapPose = () => {
  const v = mapCameraFor(aspect())
  return { pos: v.position.clone(), look: v.target.clone(), tanV: v.tanHalfV }
}

/** Full-screen warm dark fade used for cuts (interiors, home). */
function fade(to: number, duration: number) {
  const el = document.querySelector('.scene-fade')
  return new Promise<void>((resolve) => {
    if (!el) return resolve()
    gsap.to(el, { autoAlpha: to, duration, ease: 'power1.inOut', onComplete: resolve })
  })
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** resolve after `n` rendered frames (the camera's new pose has been drawn behind the fade) */
const frames = (n = 3) => new Promise<void>((r) => {
  const step = () => (--n <= 0 ? r() : requestAnimationFrame(step))
  requestAnimationFrame(step)
})
async function until(ok: () => boolean) {
  while (!ok()) await wait(60)
}

const ENTER = 5.2 // s, map -> down to the door axis -> through the door (one continuous eased flight)
const ASCEND = 3.4 // s, from the door back up to the map
const CUT = 0.3 // s, the dark fade that covers the swap into / out of the interior
const EASE = 'sine.inOut'

/** time fraction (0..1) at which an eased, constant-speed flight along `pts` reaches the point nearest `target` */
function timeAt(pts: THREE.Vector3[], target: THREE.Vector3, ease: string) {
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  let best = 0, bd = Infinity
  for (let i = 0; i <= 400; i++) {
    const d = c.getPointAt(i / 400).distanceToSquared(target)
    if (d < bd) (bd = d), (best = i / 400)
  }
  const e = gsap.parseEase(ease)
  let lo = 0, hi = 1
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2
    if (e(mid) < best) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * Fly INTO the building in ONE continuous eased flight (constant-speed path, speed from the ease
 * only): down to the door axis 10 m in front of the door at eye height, then straight through the
 * door. A ~0.3 s warm dark fade is fully opaque as the camera crosses the door; behind it the
 * camera is placed inside the room (lights switched), a few frames render, then the fade lifts
 * while the camera moves a little further FORWARD and stops. The panel opens once it has arrived.
 * Everything the room needs (models, textures, shaders, audio) is ready before the reveal.
 */
export async function goToRafid(id: RafidKey) {
  const s = store.get()
  if (s.busy || s.phase === 'loading' || s.phase === 'hero') return
  if (s.phase === 'building') {
    if (s.rafid === id && s.view) return
    await backToMap(true)
  }
  store.set({ busy: true, rafid: id, view: null, arrived: false, hover: null, phase: 'building' })
  requestHigh(...modelsOf(id))
  if (id === 'reciters') void player.preload() // decode the recitations during the flight
  const from = { pos: camCtl.current.pos.clone(), look: camCtl.current.look.clone() }
  const path = pathInto(from, id)
  const pos = [...path.descend.pos, ...path.through.pos.slice(1)]
  const look = [...path.descend.look, ...path.through.look.slice(1)]
  const flight = camCtl.fly(pos, look, ENTER, { tanV: 0.4, ease: EASE })
  const tDoor = timeAt([camCtl.current.pos.clone(), ...pos.slice(1)], path.door, EASE) * ENTER
  await wait(Math.max(0, tDoor - CUT) * 1000)
  await fade(1, CUT) // fully covered as the camera crosses the door
  await flight
  await until(() => store.get().interiorsReady && store.get().interiorsWarm)
  const o = INTERIOR_ORIGIN[id], shot = INTERIOR_SHOT[id]
  camCtl.jump({ pos: shot.from.pos.clone().add(o), look: shot.from.look.clone().add(o) }, 0.46)
  store.set({ view: 'interior' })
  await frames(3) // the room is drawn from the placed camera before anything is revealed
  const dolly = camCtl.fly([shot.from.pos.clone().add(o), shot.to.pos.clone().add(o)], [shot.from.look.clone().add(o), shot.to.look.clone().add(o)], 2.4, { ease: 'power2.out' })
  await fade(0, CUT + 0.1)
  await dolly
  store.set({ busy: false, arrived: true })
}

/** Back to the map along the same path, reversed: out through the door, then up (same dark fade). */
export async function backToMap(chained = false) {
  const s = store.get()
  if ((s.busy && !chained) || s.phase !== 'building' || !s.rafid) return
  store.set({ busy: true, arrived: false })
  const id = s.rafid
  const m = mapPose()
  const path = pathInto({ pos: m.pos, look: m.look }, id)
  if (id === 'reciters') player.stop() // the recitation ends when you leave the hall
  if (s.view === 'interior') {
    const o = INTERIOR_ORIGIN[id], shot = INTERIOR_SHOT[id]
    const back = camCtl.fly([shot.to.pos.clone().add(o), shot.from.pos.clone().add(o)], [shot.to.look.clone().add(o), shot.from.look.clone().add(o)], 1.0, { ease: 'power2.in' })
    await wait((1.0 - CUT) * 1000)
    await fade(1, CUT)
    await back
    // just outside the door, still facing in; then ONE eased flight back out along the axis and up to the map
    const outside = path.door.clone().addScaledVector(path.facing, 1.5)
    camCtl.jump({ pos: outside, look: path.through.look[1].clone() }, 0.4)
    store.set({ view: null })
    await frames(3)
    const out = camCtl.fly([outside, ...path.descend.pos.slice().reverse()], [path.through.look[1].clone(), ...path.descend.look.slice().reverse()], ASCEND + 1, { tanV: m.tanV, ease: EASE })
    await fade(0, CUT + 0.1)
    await out
  } else {
    store.set({ view: null })
    await camCtl.fly(path.descend.pos.slice().reverse(), path.descend.look.slice().reverse(), ASCEND, { tanV: m.tanV, ease: EASE })
  }
  store.set({ phase: 'map', rafid: null, busy: false })
}

/** الرئيسية: back to the start of the scroll story (fade cut; the hero intro replays). */
export async function goHome() {
  const s = store.get()
  if (s.busy || s.phase === 'hero' || s.phase === 'loading') return
  store.set({ busy: true })
  await fade(1, 0.6)
  store.set({ phase: 'hero', rafid: null, view: null, arrived: false, hover: null })
  storyScroll.jumpTo(0)
  await new Promise((r) => setTimeout(r, 120))
  store.set({ busy: false })
  await fade(0, 0.8)
}

/** تخطي: jump from anywhere in the story straight to the map (fade cut). */
export async function skipToMap() {
  const s = store.get()
  if (s.busy || s.phase !== 'hero') return
  store.set({ busy: true })
  await fade(1, 0.5)
  storyScroll.jumpTo(1)
  while (!store.get().mapReady) await new Promise((r) => setTimeout(r, 120))
  store.set({ busy: false, phase: 'map' })
  await fade(0, 0.7)
}

export function goBack() {
  const s = store.get()
  if (s.phase === 'building') void backToMap()
}
