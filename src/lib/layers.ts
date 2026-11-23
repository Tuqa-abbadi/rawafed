import * as THREE from 'three'

/** Seen by the main camera but skipped by the water's reflection camera (dense small stuff). */
export const LAYER_NO_REFLECT = 1

/** Put every mesh under `root` on the no-reflect layer only. */
export function setNoReflect(root: THREE.Object3D) {
  root.traverse((o) => o.layers.set(LAYER_NO_REFLECT))
}
