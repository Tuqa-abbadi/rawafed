"""Side-by-side sheet: ORIGINAL | HIGH | LOW (+ a 2x detail crop row) with labels.
Usage: python scripts/lod_sheet.py <name> <crop x0 y0 x1 y1 in 960x720 px> -> screens/compare/lod_<name>.jpg"""
import sys
from PIL import Image, ImageDraw, ImageFont
name = sys.argv[1]; crop = tuple(map(int, sys.argv[2:6]))
cols = [("ORIGINAL (Meshy)", f"build/cmp/{name}_orig.png"), ("HIGH (LOD near)", f"build/cmp/{name}_high.png"), ("LOW (map)", f"build/cmp/{name}_low.png")]
W, H = 640, 480
cw = crop[2] - crop[0]; ch = crop[3] - crop[1]
CH = int(W * ch / cw)
sheet = Image.new("RGB", (W * 3, 34 + H + CH), (30, 23, 18))
d = ImageDraw.Draw(sheet)
try: f = ImageFont.truetype("arial.ttf", 18)
except Exception: f = ImageFont.load_default()
import json
rep = json.load(open("build/lod_report.json")).get(name, {})
for i, (label, p) in enumerate(cols):
    im = Image.open(p).convert("RGB")
    sheet.paste(im.resize((W, H)), (i * W, 34))
    sheet.paste(im.crop(crop).resize((W, CH)), (i * W, 34 + H))
    extra = "" if i == 0 else f"  {rep.get('high' if i == 1 else 'low', {}).get('tris', '?'):,} tris" if rep else ""
    d.text((i * W + 10, 8), label + extra, fill=(235, 197, 122), font=f)
sheet.save(f"screens/compare/lod_{name}.jpg", quality=90)
print("wrote", f"screens/compare/lod_{name}.jpg")
