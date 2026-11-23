"""Textured Workbench renders of a .glb (read-only) with a coordinate grid overlay for locating things.
Usage: blender -b --factory-startup -P scripts/render_views.py -- <file.glb> <out_prefix> [views=front,back,left,right,top,persp] [res=1600]
Front looks along +Y (from -Y), so image x = model X, image y = model Z. Top: image x = X, image y = Y."""
import bpy, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
path, out = argv[0], argv[1]
views = (argv[2] if len(argv) > 2 else "front,top,persp").split(",")
res = int(argv[3]) if len(argv) > 3 else 1600
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
sc = bpy.context.scene
mins = Vector((1e9,) * 3); maxs = Vector((-1e9,) * 3)
for ob in sc.objects:
    if ob.type == "MESH":
        for c in ob.bound_box:
            w = ob.matrix_world @ Vector(c)
            mins = Vector(map(min, mins, w)); maxs = Vector(map(max, maxs, w))
ctr = (mins + maxs) / 2; size = maxs - mins
print("BBOX min", tuple(round(v, 3) for v in mins), "max", tuple(round(v, 3) for v in maxs))
sc.render.engine = "BLENDER_WORKBENCH"
sh = sc.display.shading; sh.light = "FLAT"; sh.color_type = "TEXTURE"
sc.world = bpy.data.worlds.new("w"); sc.world.color = (0.75, 0.75, 0.78)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
for v in views:
    cam.data.type = "ORTHO"
    if v == "front":
        w, h = size.x, size.z; cam.location = ctr + Vector((0, -10, 0)); cam.rotation_euler = (math.radians(90), 0, 0)
    elif v == "back":
        w, h = size.x, size.z; cam.location = ctr + Vector((0, 10, 0)); cam.rotation_euler = (math.radians(90), 0, math.radians(180))
    elif v == "left":
        w, h = size.y, size.z; cam.location = ctr + Vector((-10, 0, 0)); cam.rotation_euler = (math.radians(90), 0, math.radians(-90))
    elif v == "right":
        w, h = size.y, size.z; cam.location = ctr + Vector((10, 0, 0)); cam.rotation_euler = (math.radians(90), 0, math.radians(90))
    elif v == "top":
        w, h = size.x, size.y; cam.location = ctr + Vector((0, 0, 10)); cam.rotation_euler = (0, 0, 0)
    else:  # persp from front-left, low
        cam.data.type = "PERSP"; cam.data.lens = 35
        d = Vector((-0.5, -1.0, 0.35)).normalized() * max(size) * 1.2
        cam.location = ctr + d
        cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
        w, h = 16, 10
    sc.render.resolution_x = res; sc.render.resolution_y = max(64, int(res * h / w))
    if cam.data.type == "ORTHO":
        cam.data.ortho_scale = max(w, h) * 1.0
    sc.render.filepath = f"{out}_{v}.png"
    bpy.ops.render.render(write_still=True)
print("VIEWS_DONE")
