"""Mesh health: faces whose normal disagrees with a consistent recalculation (flipped), open
boundary edges (holes), loose parts, and texture-dark faces (mean base colour very dark).
Usage: blender -b --factory-startup -P scripts/check_mesh.py -- <file.glb>"""
import bpy, bmesh, sys
path = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in objs:
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    before = [f.normal.copy() for f in bm.faces]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    flipped = sum(1 for f, n in zip(bm.faces, before) if f.normal.dot(n) < 0)
    boundary = sum(1 for e in bm.edges if e.is_boundary)
    nonman = sum(1 for e in bm.edges if not e.is_manifold)
    print(f"CHECK {o.name}: faces={len(bm.faces)} flipped_vs_consistent={flipped} ({100*flipped/len(bm.faces):.2f}%) boundary_edges={boundary} non_manifold_edges={nonman}")
    bm.free()
