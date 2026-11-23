"""Where are the faces whose winding disagrees with the consistent orientation? Prints clusters
(normalised bbox position) and renders them red over the model (front + back views).
Usage: blender -b --factory-startup -P scripts/flipped_where.py -- <file.glb> <out_prefix>"""
import bpy, bmesh, sys, math, mathutils
from collections import Counter
path, out = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
o = [x for x in bpy.context.scene.objects if x.type == "MESH"][0]
me = o.data
bm = bmesh.new(); bm.from_mesh(me)
before = [f.normal.copy() for f in bm.faces]
bm2 = bm.copy()
bmesh.ops.remove_doubles(bm2, verts=bm2.verts, dist=1e-5)
bmesh.ops.recalc_face_normals(bm2, faces=bm2.faces)
# map back by face centre (remove_doubles keeps face order)
flip = [f2.normal.dot(f.normal) < 0 for f, f2 in zip(bm.faces, bm2.faces)]
mn = mathutils.Vector([min(v.co[i] for v in bm.verts) for i in range(3)])
mx = mathutils.Vector([max(v.co[i] for v in bm.verts) for i in range(3)])
cells = Counter()
for f, fl in zip(bm.faces, flip):
    if fl:
        c = (f.calc_center_median() - mn)
        cells[tuple(int(4 * c[i] / max(1e-9, mx[i] - mn[i])) for i in range(3))] += 1
print("FLIPPED", sum(flip), "top cells (x,y,z of a 4x4x4 grid, Blender axes):", cells.most_common(8))
# red material on flipped faces
red = bpy.data.materials.new("flip"); red.diffuse_color = (1, 0, 0, 1); red.use_nodes = True
red.node_tree.nodes["Principled BSDF"].inputs[0].default_value = (1, 0, 0, 1)
red.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (1, 0, 0, 1)
red.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 3
me.materials.append(red); idx = len(me.materials) - 1
for f, fl in zip(bm.faces, flip):
    if fl: f.material_index = idx
bm.to_mesh(me); bm.free(); bm2.free()
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"; sc.render.resolution_x, sc.render.resolution_y = 900, 600
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
cam = bpy.data.cameras.new("c"); co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
ctr = (o.matrix_world @ ((mn + mx) / 2)); size = max(mx - mn) * max(o.matrix_world.to_scale())
for name, az, el in [("front", 180, 25), ("back", 0, 25), ("top", 180, 80)]:
    d = size * 1.4
    a, e = math.radians(az), math.radians(el)
    co.location = ctr + mathutils.Vector((d * math.cos(e) * math.sin(a), -d * math.cos(e) * math.cos(a), d * math.sin(e)))
    co.rotation_euler = (ctr - co.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = f"{out}_{name}.png"; bpy.ops.render.render(write_still=True)
