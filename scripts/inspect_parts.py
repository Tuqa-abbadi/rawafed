"""Inspect a .glb: split into loose parts, list them, render front + top views with small parts in red.
Read-only (never saves the source). Usage:
  blender -b --factory-startup -P scripts/inspect_parts.py -- <file.glb> <out_prefix> [small_frac=0.12]
small_frac: a part is 'small' if its bbox height < small_frac * model height."""
import bpy, bmesh, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
path, out = argv[0], argv[1]
small_frac = float(argv[2]) if len(argv) > 2 else 0.12
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
ob = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
bpy.context.view_layer.objects.active = ob
ob.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

me = ob.data
bm = bmesh.new(); bm.from_mesh(me)
# Meshy splits the mesh along UV seams; weld so loose parts are real objects (UVs live on loops, so they survive).
weld = float(os.environ.get("WELD", "0.0005"))
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld)
bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
# islands by linked faces
seen = set(); islands = []
for f in bm.faces:
    if f.index in seen: continue
    stack = [f]; isl = []; seen.add(f.index)
    while stack:
        cur = stack.pop(); isl.append(cur.index)
        for e in cur.edges:
            for nf in e.link_faces:
                if nf.index not in seen:
                    seen.add(nf.index); stack.append(nf)
    islands.append(isl)
zmin = min(v.co.z for v in bm.verts); zmax = max(v.co.z for v in bm.verts)
H = zmax - zmin
info = []
for i, isl in enumerate(islands):
    vs = {v for fi in isl for v in bm.faces[fi].verts}
    xs = [v.co.x for v in vs]; ys = [v.co.y for v in vs]; zs = [v.co.z for v in vs]
    info.append(dict(i=i, faces=len(isl), x=(min(xs), max(xs)), y=(min(ys), max(ys)), z=(min(zs), max(zs))))
print(f"PARTS total={len(islands)} faces={len(bm.faces)} H={H:.3f} bbox_z=({zmin:.3f},{zmax:.3f})")
big = sorted(info, key=lambda d: -d["faces"])[:12]
for d in big:
    print("BIG", d["i"], d["faces"], "x=(%.2f,%.2f) y=(%.2f,%.2f) z=(%.2f,%.2f)" % (*d["x"], *d["y"], *d["z"]))
foot = float(os.environ.get("FOOT", "0.1"))  # max x/y extent of a 'small' compact object
small = [d for d in info if (d["z"][1] - d["z"][0]) < small_frac * H
         and (d["x"][1] - d["x"][0]) < foot and (d["y"][1] - d["y"][0]) < foot and d["faces"] > 30]
print("SMALL count", len(small))
for d in sorted(small, key=lambda d: d["y"][0])[:60]:
    print("SM", d["i"], d["faces"], "x=(%.3f,%.3f) y=(%.3f,%.3f) z=(%.3f,%.3f)" % (*d["x"], *d["y"], *d["z"]))

# colour small parts red via a second material
red = bpy.data.materials.new("red"); red.diffuse_color = (1, 0, 0, 1)
me.materials.append(red); ri = len(me.materials) - 1
small_faces = {fi for d in small for fi in islands[d["i"]]}
for f in bm.faces:
    if f.index in small_faces: f.material_index = ri
bm.to_mesh(me); bm.free()

sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"; sc.display.shading.color_type = "MATERIAL"
sc.render.resolution_x, sc.render.resolution_y = 1200, 800
sc.world = bpy.data.worlds.new("w"); sc.world.color = (0.9, 0.88, 0.84)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"
xs = [c[0] for c in ob.bound_box]; ys = [c[1] for c in ob.bound_box]
ctr = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (zmin + zmax) / 2))
span = max(max(xs) - min(xs), max(ys) - min(ys), H) * 1.1
cam.data.ortho_scale = span
for name, loc, rot in [("front", ctr + Vector((0, -10, 0)), (math.radians(90), 0, 0)),
                       ("top", ctr + Vector((0, 0, 10)), (0, 0, 0)),
                       ("persp", None, None)]:
    if name == "persp":
        cam.data.type = "PERSP"; cam.data.lens = 35
        d = Vector((0.6, -1.0, 0.55)).normalized() * span * 1.3
        cam.location = ctr + d
        cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
    else:
        cam.location = loc; cam.rotation_euler = rot
    sc.render.filepath = f"{out}_{name}.png"
    bpy.ops.render.render(write_still=True)
print("INSPECT_DONE")
