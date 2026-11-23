# Walker: remove what is left of the two old shemagh back flaps under the new single back piece
# (small bits that poke through it while he walks). Works on the current walker (with the
# 'shemagh_back' cloth from walker_shemagh.py); only body faces UNDER the cloth outline that stand
# off the back are removed — the cloth covers that area, so nothing opens up.
# Usage: blender -b --factory-startup -P scripts/walker_flap_cleanup.py -- <in.glb> <out.glb>
import bpy, sys
import bmesh
from mathutils import Vector

src, dst = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
body = next(o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'shemagh_back' and len(o.data.vertices) > 1000)
cloth = bpy.data.objects.get('shemagh_back')
arm = body.parent
arm.data.pose_position = 'REST'
bpy.context.view_layer.update()
mw = body.matrix_world
inv = mw.inverted()

# same outline as walker_shemagh.py (+1.5 cm margin)
Z_TOP, Z_SH, Z_V, Z_TIP = 1.68, 1.42, 1.28, 1.06
HW_TOP, HW = 0.085, 0.215
def half_width(z):
    if z >= Z_SH: return HW_TOP + (HW - HW_TOP) * (Z_TOP - z) / (Z_TOP - Z_SH)
    if z >= Z_V: return HW
    return HW * max(0.0, (z - Z_TIP) / (Z_V - Z_TIP))
def inside(x, z, pad=-0.01):
    return Z_TIP - pad <= z <= Z_TOP and abs(x) <= half_width(min(max(z, Z_TIP), Z_TOP)) + pad

def back_y(x, z):
    o = inv @ Vector((x, 1.0, z))
    d = (inv.to_3x3() @ Vector((0, -1, 0))).normalized()
    hit, loc, _, _ = body.ray_cast(o, d)
    return (mw @ loc).y if hit else None

# the thobe's back surface, sampled below the cloth (no flaps there), per 2 cm column
def thobe_back(x):
    ys = [back_y(x, z) for z in (0.96, 1.0, 1.04)]
    ys = [y for y in ys if y is not None]
    return sum(ys) / len(ys) if ys else 0.0
base = {i: thobe_back(i * 0.02) for i in range(-15, 16)}

# the cloth's own height per 2 cm cell: anything of the body closer than 1 cm below it is "poking"
me = body.data
bm = bmesh.new()
bm.from_mesh(me)
kill = []
for f in bm.faces:
    c = mw @ f.calc_center_median()
    # centre of the back only (where the flaps hung); the shoulders and the head stay untouched
    if not (1.08 <= c.z <= 1.40) or abs(c.x) > 0.16 or c.y > 0.25: continue
    if not inside(c.x, c.z): continue
    b = base.get(round(c.x / 0.02), 0.0)
    # standing clearly off the thobe's back (an old flap remnant), or any part of a face doing so
    far = max((mw @ v.co).y for v in f.verts)
    if c.y > b + 0.012 or far > b + 0.03:
        kill.append(f)
print('remnant faces removed:', len(kill))
bmesh.ops.delete(bm, geom=kill, context='FACES')
bm.to_mesh(me)
bm.free()

arm.data.pose_position = 'POSE'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_animations=True, export_skins=True,
                          export_image_format='WEBP', export_apply=False, export_yup=True)
print('WROTE', dst)
