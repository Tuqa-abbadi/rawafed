"""Render GLBs with an identical camera and light (fair before/after comparison).
Each model is fitted so its longest horizontal side = SIZE metres, base centred at the origin.
Usage: blender -b --factory-startup -P scripts/render_compare.py -- SIZE AZ EL DIST TY out1.png in1.glb [out2.png in2.glb ...]
  AZ: degrees around +Z (0 = camera on -Y looking +Y, i.e. glTF +Z front), EL: degrees, DIST: x SIZE, TY: look height x height
"""
import bpy, sys, math, mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
SIZE, AZ, EL, DIST, TY = map(float, argv[:5])
pairs = list(zip(argv[5::2], argv[6::2]))

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE_NEXT"
    sc.render.resolution_x, sc.render.resolution_y = 960, 720
    sc.view_settings.view_transform = "AgX"
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.62, 0.68, 0.78, 1); bg.inputs[1].default_value = 0.9
    sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 4.0; sun.color = (1.0, 0.9, 0.78); sun.angle = math.radians(2)
    so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-35))
    return sc

for out, path in pairs:
    sc = reset()
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in sc.objects if o.type == "MESH"]
    # world-space bbox of all meshes
    pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
    mn = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    s = SIZE / max(mx.x - mn.x, mx.y - mn.y)
    root = bpy.data.objects.new("fit", None); sc.collection.objects.link(root)
    for o in sc.objects:
        if o.parent is None and o is not root and o.type not in ("LIGHT",):
            o.parent = root
    root.location = (-(mn.x + mx.x) / 2 * s, -(mn.y + mx.y) / 2 * s, -mn.z * s)
    root.scale = (s, s, s)
    h = (mx.z - mn.z) * s
    cam = bpy.data.cameras.new("cam"); cam.lens = 50
    co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); sc.camera = co
    d = SIZE * DIST
    az, el = math.radians(AZ), math.radians(EL)
    co.location = (d * math.cos(el) * math.sin(az), -d * math.cos(el) * math.cos(az), h * TY + d * math.sin(el))
    target = mathutils.Vector((0, 0, h * TY))
    co.rotation_euler = (target - co.location).to_track_quat("-Z", "Y").to_euler()
    tris = sum(len(o.data.polygons) for o in meshes)
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED {out} faces={tris}")
