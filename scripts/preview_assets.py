"""Render a quick textured Workbench preview of every .glb (read-only).
Usage: blender -b --factory-startup -P scripts/preview_assets.py -- <assets_dir> <out_dir>"""
import bpy, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
root, out = argv[0], argv[1]
os.makedirs(out, exist_ok=True)
for dirpath, _, files in os.walk(root):
    for f in sorted(files):
        if not f.lower().endswith(".glb"):
            continue
        rel = os.path.relpath(os.path.join(dirpath, f), root).replace("\\", "/")
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=os.path.join(dirpath, f))
        sc = bpy.context.scene
        mins = Vector((1e9,)*3); maxs = Vector((-1e9,)*3)
        for ob in sc.objects:
            if ob.type == "MESH":
                for c in ob.bound_box:
                    w = ob.matrix_world @ Vector(c)
                    mins = Vector(map(min, mins, w)); maxs = Vector(map(max, maxs, w))
        ctr = (mins + maxs) / 2; size = (maxs - mins).length
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        sc.collection.objects.link(cam); sc.camera = cam
        d = Vector((0.0, -1.0, 0.45)).normalized() * size * 1.25
        d.rotate(__import__("mathutils").Euler((0, 0, math.radians(-30))))
        cam.location = ctr + d
        cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.engine = "BLENDER_WORKBENCH"
        sh = sc.display.shading
        sh.light = "STUDIO"; sh.color_type = "TEXTURE"
        sc.render.resolution_x = sc.render.resolution_y = 384
        sc.world = bpy.data.worlds.new("w"); sc.world.color = (0.9, 0.87, 0.8)
        sc.render.filepath = os.path.join(out, rel.replace("/", "__").replace(".glb", ".png"))
        bpy.ops.render.render(write_still=True)
        print("RENDERED", rel)
print("PREVIEW_DONE")
