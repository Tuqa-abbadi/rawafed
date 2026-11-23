"""Stage 2: prepare ONE model from assets/ (never modified) into build/raw/<out>.glb.
Steps: import -> join -> apply transforms -> weld -> (trim) -> scale to real size
-> origin at base centre -> export glTF (+Y up). Rigged models: only scale (skeleton + clips untouched).
Triangle reduction + texture/mesh compression happen next in scripts/compress.mjs.
Usage: blender -b --factory-startup -P scripts/optimize_model.py -- <project_root> <out_name>
Prints a JSON line 'RESULT {...}' with before/after stats."""
import bpy, bmesh, sys, os, json, time
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
root, name = argv[0], argv[1]
cfg = next(m for m in json.load(open(os.path.join(root, "scripts/models.json")))["models"] if m["out"] == name)
src = os.path.join(root, "assets", cfg["src"])
dst_dir = os.path.join(root, "build", "raw"); os.makedirs(dst_dir, exist_ok=True)
dst = os.path.join(dst_dir, name + ".glb")
t0 = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
meshes = [o for o in sc.objects if o.type == "MESH"]


def tri_count(objs):
    dg = bpy.context.evaluated_depsgraph_get(); n = 0
    for o in objs:
        m = o.evaluated_get(dg).data; m.calc_loop_triangles(); n += len(m.loop_triangles)
    return n


def world_bbox(objs):
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        ev = o.evaluated_get(dg)
        for v in ev.data.vertices:
            w = ev.matrix_world @ v.co
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    return mn, mx


def scale_for(mn, mx):
    d = mx - mn; s = cfg["size"]
    cur = {"x": d.x, "y": d.y, "z": d.z, "xy": max(d.x, d.y)}[s["dim"]]
    return s["m"] / cur


tris_before = tri_count(meshes)
result = {"name": name, "src": cfg["src"], "tris_before": tris_before}

if cfg.get("rigged"):
    arm = next(o for o in sc.objects if o.type == "ARMATURE")
    # drop stray non-skinned meshes (walker_rigged.glb ships an unparented 2 m 'Icosphere')
    for o in list(meshes):
        if not any(m.type == "ARMATURE" for m in o.modifiers):
            result.setdefault("removed", []).append(o.name)
            bpy.data.objects.remove(o)
    meshes = [o for o in sc.objects if o.type == "MESH"]
    arm.data.pose_position = "REST"; bpy.context.view_layer.update()
    mn, mx = world_bbox(meshes)
    s = scale_for(mn, mx)
    root_obj = arm
    while root_obj.parent: root_obj = root_obj.parent
    # scale + move so feet are at 0 and centred (node transform only; clips untouched)
    root_obj.scale = root_obj.scale * s
    bpy.context.view_layer.update()
    mn, mx = world_bbox(meshes); c = (mn + mx) / 2
    root_obj.location -= Vector((c.x, c.y, mn.z))
    arm.data.pose_position = "POSE"
    bpy.context.view_layer.update()
    mn, mx = world_bbox(meshes)
    arm.data.pose_position = "REST"; bpy.context.view_layer.update()
    mn, mx = world_bbox(meshes)
    result.update(scale=s, dims_m=[round(v, 2) for v in (mx - mn)], tris_after=tri_count(meshes),
                  actions=[a.name for a in bpy.data.actions])
    arm.data.pose_position = "POSE"
    bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_animations=True,
                              export_skins=True, export_yup=True, export_apply=False)
else:
    # join + apply
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    for o in list(sc.objects):
        if o is not ob and o.type != "MESH": bpy.data.objects.remove(o)
    ob.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002)  # Meshy splits along UV seams
    if cfg.get("fix_normals"):
        # some Meshy models have patches wound the wrong way (learning.glb: 0.46% of faces, mostly
        # behind the glass); they render dark / culled. Make the winding consistent (outward).
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if cfg.get("trim"):
        x0, x1, y0, y1 = cfg["trim"]
        for co, no in [((x0, 0, 0), (-1, 0, 0)), ((x1, 0, 0), (1, 0, 0)), ((0, y0, 0), (0, -1, 0)), ((0, y1, 0), (0, 1, 0))]:
            geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, clear_outer=True)
        # drop tiny floating leftovers created by the cuts
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(ob.data); bm.free()
    ob.data.update()

    # NOTE: no decimation here. Blender's collapse destroyed thin parts and smeared UVs at these
    # ratios (tested on pergola); triangle reduction is done by meshoptimizer in scripts/compress.mjs.

    mn, mx = world_bbox([ob]); s = scale_for(mn, mx)
    c = (mn + mx) / 2
    ob.data.transform(Matrix.Translation(Vector((-c.x, -c.y, -mn.z))))
    ob.data.transform(Matrix.Scale(s, 4))
    ob.data.update()
    ob.location = (0, 0, 0)
    mn, mx = world_bbox([ob])
    result.update(scale=s, dims_m=[round(v, 2) for v in (mx - mn)], tris_after=tri_count([ob]))
    bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_yup=True, export_apply=True,
                              export_animations=False, export_texcoords=True, export_normals=True)

result["seconds"] = round(time.time() - t0, 1)
result["raw_bytes"] = os.path.getsize(dst)
print("RESULT " + json.dumps(result))
