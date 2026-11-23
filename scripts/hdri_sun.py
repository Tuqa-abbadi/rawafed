"""Find the sun direction in an equirect HDRI (brightest pixel). Usage: blender -b -P scripts/hdri_sun.py -- <file.hdr>"""
import bpy, sys, math
import numpy as np
path = sys.argv[sys.argv.index("--") + 1]
im = bpy.data.images.load(path)
w, h = im.size
px = np.empty(w * h * 4, dtype=np.float32); im.pixels.foreach_get(px)
px = px.reshape(h, w, 4)  # row 0 = bottom
lum = px[..., 0] * 0.2126 + px[..., 1] * 0.7152 + px[..., 2] * 0.0722
y, x = np.unravel_index(np.argmax(lum), lum.shape)
u, v = (x + 0.5) / w, (y + 0.5) / h
elev = (v - 0.5) * math.pi
# three.js equirect: u=0.5 looks down -Z ... report u and elevation; direction per three.js convention:
phi = (u - 0.5) * 2 * math.pi  # azimuth from -Z toward +X? computed below
theta = u * 2 * math.pi
d = (-math.cos(elev) * math.sin(theta + math.pi/2) * -1, math.sin(elev), 0)
print(f"SUN u={u:.4f} v={v:.4f} elev_deg={math.degrees(elev):.2f} peak={lum.max():.1f} median={float(np.median(lum)):.3f} size={w}x{h}")
