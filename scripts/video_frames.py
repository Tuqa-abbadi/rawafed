"""Extract one frame every N seconds from a video using Blender's built-in ffmpeg (VSE).
Usage: blender -b --factory-startup -P scripts/video_frames.py -- <video> <out_dir> [every_sec=2] [width=1280]"""
import bpy, sys, os
argv = sys.argv[sys.argv.index("--") + 1:]
video, out = argv[0], argv[1]
every = float(argv[2]) if len(argv) > 2 else 2.0
width = int(argv[3]) if len(argv) > 3 else 1280
os.makedirs(out, exist_ok=True)
sc = bpy.context.scene
ed = sc.sequence_editor_create()
strips = ed.strips if hasattr(ed, "strips") else ed.sequences
st = strips.new_movie(name="v", filepath=video, channel=1, frame_start=1)
clip = bpy.data.movieclips.load(video)
fps = clip.fps or 24
w, h = clip.size
sc.render.fps = int(round(fps)); sc.render.fps_base = sc.render.fps / fps
sc.render.resolution_x = width; sc.render.resolution_y = int(round(h * width / w / 2) * 2)
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "JPEG"; sc.render.image_settings.quality = 90
sc.frame_start = 1; sc.frame_end = st.frame_final_end - 1
dur = (sc.frame_end - sc.frame_start + 1) / fps
print(f"VIDEO fps={fps:.3f} size={w}x{h} frames={sc.frame_end} duration={dur:.2f}s")
t = 0.0; n = 0
while True:
    f = int(round(t * fps)) + 1
    if f > sc.frame_end: break
    sc.frame_set(f)
    sc.render.filepath = os.path.join(out, f"t{int(t):03d}s.jpg")
    bpy.ops.render.render(write_still=True)
    n += 1; t += every
print("FRAMES_DONE", n)
