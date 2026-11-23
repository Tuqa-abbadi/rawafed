"""Headless asset inventory: triangle counts, meshes, armatures, animations.
Usage: blender -b -P scripts/inventory.py -- <assets_dir> <out_json>
Read-only: imports each .glb into an empty scene, never saves."""
import bpy, sys, os, json

argv = sys.argv[sys.argv.index("--") + 1:]
root, out = argv[0], argv[1]
results = []
for dirpath, _, files in os.walk(root):
    for f in sorted(files):
        if not f.lower().endswith((".glb", ".gltf")):
            continue
        path = os.path.join(dirpath, f)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        rec = {"file": os.path.relpath(path, root).replace("\\", "/"), "bytes": os.path.getsize(path)}
        try:
            bpy.ops.import_scene.gltf(filepath=path)
            dg = bpy.context.evaluated_depsgraph_get()
            tris = 0; meshes = 0; mats = set(); imgs = set()
            for ob in bpy.context.scene.objects:
                if ob.type == "MESH":
                    meshes += 1
                    me = ob.evaluated_get(dg).data
                    me.calc_loop_triangles()
                    tris += len(me.loop_triangles)
                    for s in ob.material_slots:
                        if s.material: mats.add(s.material.name)
            for im in bpy.data.images:
                if im.size[0]: imgs.add(f"{im.size[0]}x{im.size[1]}")
            dims = None
            mins = [1e9]*3; maxs = [-1e9]*3
            from mathutils import Vector
            for ob in bpy.context.scene.objects:
                if ob.type == "MESH":
                    for c in ob.bound_box:
                        w = ob.matrix_world @ Vector(c)
                        for i in range(3):
                            mins[i] = min(mins[i], w[i]); maxs[i] = max(maxs[i], w[i])
            if meshes:
                dims = [round(maxs[i]-mins[i], 2) for i in range(3)]
            rec.update(tris=tris, meshes=meshes, materials=len(mats), textures=sorted(imgs),
                       armatures=sum(1 for o in bpy.context.scene.objects if o.type == "ARMATURE"),
                       actions=[a.name for a in bpy.data.actions], dims_xyz=dims)
        except Exception as e:
            rec["error"] = str(e)
        results.append(rec)
with open(out, "w", encoding="utf-8") as fh:
    json.dump(results, fh, indent=1)
print("INVENTORY_DONE", len(results))
