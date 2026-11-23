# Walker: replace the two split back flaps of the shemagh with ONE traditional Gulf shemagh back
# piece (a single white cloth falling over the back of the head and shoulders, ending in one soft
# triangular point in the middle of the upper back).
#  - the new cloth is shaped from ray scans of the back (it lies just over the old flaps, covering
#    them), uses the same material (UV on a white shemagh texel) and gets its skin weights copied from
#    the body under it, so it moves with the walk
#  - flap tails that would stick out below / beside the new piece are removed
# Usage: blender -b --factory-startup -P scripts/walker_shemagh.py -- <in.glb> <out.glb>
import bpy, sys, math
import bmesh
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, dst = args[0], args[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
body = bpy.data.objects['char1']
arm = body.parent
# scan and build in the REST pose (ray_cast reads the evaluated mesh; the cloth is bound in rest)
arm.data.pose_position = 'REST'
bpy.context.view_layer.update()
mw = body.matrix_world
me = body.data
inv = mw.inverted()
inv3 = inv.to_3x3()

# ---- outline (world metres; +Y = behind the man, Z up) ----
Z_TOP, Z_SH, Z_V, Z_TIP = 1.68, 1.42, 1.28, 1.06
HW_TOP, HW = 0.085, 0.215
def half_width(z):
    if z >= Z_SH: return HW_TOP + (HW - HW_TOP) * (Z_TOP - z) / (Z_TOP - Z_SH)
    if z >= Z_V: return HW
    return HW * max(0.0, (z - Z_TIP) / (Z_V - Z_TIP))
def inside(x, z, pad=0.0):
    return Z_TIP - pad <= z <= Z_TOP + pad and abs(x) <= half_width(min(max(z, Z_TIP), Z_TOP)) + pad

def back_depth(x, z):
    """back-most surface y at (x, z), seen from behind"""
    o = inv @ Vector((x, 1.0, z))
    d = (inv3 @ Vector((0, -1, 0))).normalized()
    hit, loc, nrm, fi = body.ray_cast(o, d)
    return ((mw @ loc).y, fi, loc) if hit else (None, None, None)

# ---- remove the two old back flaps (they would poke through the new piece when he walks) ----
# faces of the old flaps hang behind the back between z 1.12 and 1.52; anything there that is
# clearly off the body surface and outside the new cloth outline goes
def thobe_back(x):
    """body back surface (y) under the flaps: sampled lower down, where there are no flaps"""
    ys = [back_depth(x, z)[0] for z in (0.98, 1.02, 1.06)]
    ys = [y for y in ys if y is not None]
    return (sum(ys) / len(ys)) if ys else 0.0
base = {round(x, 2): thobe_back(x) for x in [i * 0.02 - 0.3 for i in range(31)]}
bm = bmesh.new()
bm.from_mesh(me)
kill = []
for f in bm.faces:
    c = mw @ f.calc_center_median()
    if not (1.10 <= c.z <= 1.52) or abs(c.x) > 0.17 or c.y > 0.22: continue  # (arms swing at |x| > 0.18)
    b = base.get(round(round(c.x / 0.02) * 0.02, 2), 0.0)
    if c.y > b + 0.035 and c.y > 0.03:  # well behind the back = a hanging flap, not the thobe
        kill.append(f)
print('flap faces removed:', len(kill))
bmesh.ops.delete(bm, geom=kill, context='FACES')
bm.to_mesh(me)
bm.free()

bpy.context.view_layer.update()  # the scans below see the body without the flaps

# ---- white shemagh texel (UV) from the back of the head ----
me = body.data
uvl = me.uv_layers.active.data
_, fi, loc = back_depth(0.0, 1.62)
poly = me.polygons[fi]
li = min(poly.loop_indices, key=lambda l: (me.vertices[me.loops[l].vertex_index].co - loc).length)
white_uv = tuple(uvl[li].uv)

# ---- cloth grid: rows top -> tip, same column count per row (converges to the point) ----
ROWS, COLS = 30, 17
grid = []
for r in range(ROWS):
    z = Z_TOP - (Z_TOP - Z_TIP) * r / (ROWS - 1)
    hw = max(half_width(z), 0.0015)
    row = []
    for c in range(COLS):
        x = -hw + 2 * hw * c / (COLS - 1)
        # deepest point in a small neighbourhood (cover the flap edges)
        best = None
        for dx in (-0.02, 0, 0.02):
            for dz in (-0.02, 0, 0.02):
                y, _, _ = back_depth(x + dx, z + dz)
                if y is not None and (best is None or y > best): best = y
        row.append([x, best, z])
    grid.append(row)
# fill misses from neighbours, then smooth (but never sink under the scanned surface)
for _ in range(4):
    for r in range(ROWS):
        for c in range(COLS):
            if grid[r][c][1] is None:
                ns = [grid[rr][cc][1] for rr, cc in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)) if 0 <= rr < ROWS and 0 <= cc < COLS and grid[rr][cc][1] is not None]
                if ns: grid[r][c][1] = max(ns)
raw = [[(p[1] if p[1] is not None else 0.0) for p in row] for row in grid]
ys = [row[:] for row in raw]
for _ in range(14):
    nxt = [row[:] for row in ys]
    for r in range(ROWS):
        for c in range(COLS):
            acc, n = 0.0, 0
            for rr, cc in ((r,c),(r-1,c),(r+1,c),(r,c-1),(r,c+1)):
                if 0 <= rr < ROWS and 0 <= cc < COLS: acc += ys[rr][cc]; n += 1
            nxt[r][c] = acc / n
    ys = nxt
for r in range(ROWS):
    for c in range(COLS):
        top = r < 3  # tuck the top edge in under the agal
        off = 0.004 if top else 0.026
        # soft edges: the sides and the point fall a little closer to the body
        edge = abs(c - (COLS - 1) / 2) / ((COLS - 1) / 2)
        grid[r][c][1] = max(ys[r][c] + off, raw[r][c] + 0.01) - 0.006 * edge * edge  # smooth drape, never into the body

# ---- build the cloth mesh ----
cm = bpy.data.meshes.new('shemagh_back')
bm = bmesh.new()
vs = [[bm.verts.new(Vector(p)) for p in row] for row in grid]
for r in range(ROWS - 1):
    for c in range(COLS - 1):
        bm.faces.new((vs[r][c], vs[r+1][c], vs[r+1][c+1], vs[r][c+1]))
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)  # the tip row collapses into one point
bm.normal_update()
# outward (+Y, away from the back)
if sum(f.normal.y for f in bm.faces) < 0:
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
uv = bm.loops.layers.uv.new('UVMap')
for f in bm.faces:
    for l in f.loops: l[uv].uv = white_uv
bm.to_mesh(cm)
bm.free()
cloth = bpy.data.objects.new('shemagh_back', cm)
bpy.context.scene.collection.objects.link(cloth)
cm.materials.append(me.materials[0])
for p in cm.polygons: p.use_smooth = True

# same space as the body mesh (the exporter writes skinned meshes in their local space): the
# cloth data goes into body-local coordinates and the object copies the body's parenting
cm.transform(mw.inverted())
cloth.parent = arm
cloth.matrix_parent_inverse = body.matrix_parent_inverse.copy()
cloth.matrix_basis = body.matrix_basis.copy()
bpy.context.view_layer.update()

# ---- skin weights copied from the body right under the cloth (so they bend together), minus the
# upper-arm/forearm/hand bones (in this rig's bind pose the arms swing behind the shoulders) ----
for g in body.vertex_groups:
    cloth.vertex_groups.new(name=g.name)
bpy.context.view_layer.objects.active = cloth
cloth.select_set(True)
dt = cloth.modifiers.new('dt', 'DATA_TRANSFER')
dt.object = body
dt.use_vert_data = True
dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'
dt.layers_vgroup_select_src = 'ALL'
dt.layers_vgroup_select_dst = 'NAME'
bpy.ops.object.modifier_apply(modifier='dt')
names = [g.name for g in cloth.vertex_groups]
arms = [g for g in cloth.vertex_groups if any(k in g.name for k in ('Arm', 'Hand'))]
head = cloth.vertex_groups.get('mixamorig:Head') or cloth.vertex_groups.get('mixamorigHead')
for v in cm.vertices:
    z = (mw @ v.co).z
    ws = {g.group: g.weight for g in v.groups}
    for g in arms: ws.pop(g.index, None)
    if z > 1.56 and head is not None:  # the top stays on the head
        ws = {head.index: 1.0}
    tot = sum(ws.values())
    for g in cloth.vertex_groups:
        g.remove([v.index])
    if tot <= 1e-6:
        continue
    for gi, w in ws.items():
        if w / tot > 1e-4:
            cloth.vertex_groups[gi].add([v.index], w / tot, 'REPLACE')
am = cloth.modifiers.new('Armature', 'ARMATURE')
am.object = arm

arm.data.pose_position = 'POSE'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_animations=True, export_skins=True,
                          export_image_format='WEBP', export_apply=False, export_yup=True)
print('WROTE', dst)
